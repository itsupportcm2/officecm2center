alter table public.stock_transactions add column if not exists destination_location_id uuid references public.locations(id) on delete restrict;

create or replace function public.stock_adjust(
  p_item_id uuid, p_location_id uuid, p_counted_quantity numeric,
  p_reference_no text, p_reason text, p_note text default null
) returns public.stock_transactions language plpgsql security definer set search_path=public as $$
declare v_before numeric(14,2); v_difference numeric(14,2); v_tx public.stock_transactions;
begin
  if auth.uid() is null or public.current_role() = 'viewer' then raise exception 'permission denied'; end if;
  if p_counted_quantity < 0 then raise exception 'counted quantity cannot be negative'; end if;
  if nullif(trim(p_reference_no),'') is null or nullif(trim(p_reason),'') is null then raise exception 'reference and reason are required'; end if;
  insert into public.stock_balances(item_id,location_id,quantity) values(p_item_id,p_location_id,0) on conflict(item_id,location_id) do nothing;
  select quantity into v_before from public.stock_balances where item_id=p_item_id and location_id=p_location_id for update;
  if v_before = p_counted_quantity then raise exception 'no adjustment required'; end if;
  v_difference := abs(p_counted_quantity-v_before);
  update public.stock_balances set quantity=p_counted_quantity where item_id=p_item_id and location_id=p_location_id;
  insert into public.stock_transactions(item_id,location_id,transaction_type,quantity,quantity_before,quantity_after,reference_no,purpose,note,created_by)
  values(p_item_id,p_location_id,'ADJUST',v_difference,v_before,p_counted_quantity,p_reference_no,p_reason,p_note,auth.uid()) returning * into v_tx;
  return v_tx;
end $$;

create or replace function public.stock_transfer(
  p_item_id uuid, p_source_location_id uuid, p_destination_location_id uuid, p_quantity numeric,
  p_reference_no text, p_reason text, p_note text default null
) returns public.stock_transactions language plpgsql security definer set search_path=public as $$
declare v_source_before numeric(14,2); v_destination_before numeric(14,2); v_tx public.stock_transactions;
begin
  if auth.uid() is null or public.current_role() = 'viewer' then raise exception 'permission denied'; end if;
  if p_source_location_id = p_destination_location_id then raise exception 'source and destination must differ'; end if;
  if p_quantity <= 0 then raise exception 'quantity must be greater than zero'; end if;
  if nullif(trim(p_reference_no),'') is null or nullif(trim(p_reason),'') is null then raise exception 'reference and reason are required'; end if;
  insert into public.stock_balances(item_id,location_id,quantity) values(p_item_id,p_source_location_id,0) on conflict(item_id,location_id) do nothing;
  insert into public.stock_balances(item_id,location_id,quantity) values(p_item_id,p_destination_location_id,0) on conflict(item_id,location_id) do nothing;
  perform 1 from public.stock_balances where item_id=p_item_id and location_id in (p_source_location_id,p_destination_location_id) order by location_id for update;
  select quantity into v_source_before from public.stock_balances where item_id=p_item_id and location_id=p_source_location_id;
  select quantity into v_destination_before from public.stock_balances where item_id=p_item_id and location_id=p_destination_location_id;
  if v_source_before < p_quantity then raise exception 'insufficient stock at source'; end if;
  update public.stock_balances set quantity=v_source_before-p_quantity where item_id=p_item_id and location_id=p_source_location_id;
  update public.stock_balances set quantity=v_destination_before+p_quantity where item_id=p_item_id and location_id=p_destination_location_id;
  insert into public.stock_transactions(item_id,location_id,destination_location_id,transaction_type,quantity,quantity_before,quantity_after,reference_no,purpose,note,created_by)
  values(p_item_id,p_source_location_id,p_destination_location_id,'TRANSFER',p_quantity,v_source_before,v_source_before-p_quantity,p_reference_no,p_reason,p_note,auth.uid()) returning * into v_tx;
  return v_tx;
end $$;

revoke all on function public.stock_adjust(uuid,uuid,numeric,text,text,text) from public;
revoke all on function public.stock_transfer(uuid,uuid,uuid,numeric,text,text,text) from public;
grant execute on function public.stock_adjust(uuid,uuid,numeric,text,text,text) to authenticated;
grant execute on function public.stock_transfer(uuid,uuid,uuid,numeric,text,text,text) to authenticated;

create table public.renewals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  expiry_date date not null,
  remind_days integer not null default 30 check (remind_days between 0 and 365),
  cycle_count integer not null default 1 check (cycle_count between 1 and 60),
  cycle_unit text not null default 'year' check (cycle_unit in ('month','year')),
  owner text not null,
  estimated_cost numeric(14,2) not null default 0 check (estimated_cost >= 0),
  document_url text,
  note text not null default '',
  is_active boolean not null default true,
  last_renewed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.purchase_requests (
  id uuid primary key default gen_random_uuid(),
  request_no text not null unique,
  status text not null default 'DRAFT' check(status in ('DRAFT','SUBMITTED','ORDERED','CANCELLED')),
  note text not null default '',
  requested_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.purchase_request_lines (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.purchase_requests(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete restrict,
  quantity numeric(14,2) not null check(quantity > 0),
  unit text not null,
  unique(request_id,item_id)
);

create table public.renewal_history (
  id uuid primary key default gen_random_uuid(),
  renewal_id uuid not null references public.renewals(id) on delete restrict,
  previous_expiry_date date not null,
  new_expiry_date date not null,
  cost numeric(14,2),
  evidence_url text,
  note text,
  renewed_by uuid references auth.users(id) on delete set null default auth.uid(),
  renewed_at timestamptz not null default now()
);

create table public.app_settings (
  id boolean primary key default true check (id),
  company_name text not null,
  system_name text not null,
  admin_email text not null,
  low_stock_alert boolean not null default true,
  out_of_stock_alert boolean not null default true,
  renewal_alert boolean not null default true,
  weekly_summary boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null default auth.uid()
);

insert into public.app_settings(id,company_name,system_name,admin_email)
values(true,'บริษัท เชียงใหม่โฟรเซ่นฟูดส์ จำกัด','ระบบจัดการสำนักงาน เชียงใหม่โฟรเซ่นฟูดส์','admin@example.co.th')
on conflict(id) do nothing;

create table public.audit_logs (
  id bigint generated always as identity primary key,
  table_name text not null,
  record_id text,
  action text not null check (action in ('INSERT','UPDATE','DELETE')),
  old_data jsonb,
  new_data jsonb,
  actor_id uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index renewals_expiry_idx on public.renewals(expiry_date) where is_active;
create index purchase_requests_created_idx on public.purchase_requests(created_at desc);
create index purchase_request_lines_request_idx on public.purchase_request_lines(request_id);
create index renewal_history_renewal_idx on public.renewal_history(renewal_id,renewed_at desc);
create index audit_logs_record_idx on public.audit_logs(table_name,record_id,created_at desc);

create trigger renewals_updated_at before update on public.renewals for each row execute function public.set_updated_at();
create trigger purchase_requests_updated_at before update on public.purchase_requests for each row execute function public.set_updated_at();
create trigger settings_updated_at before update on public.app_settings for each row execute function public.set_updated_at();

create function public.write_audit_log() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.audit_logs(table_name,record_id,action,old_data,new_data,actor_id)
  values(tg_table_name,coalesce(new.id::text,old.id::text),tg_op,case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end,auth.uid());
  return coalesce(new,old);
end $$;

create trigger audit_items after insert or update or delete on public.items for each row execute function public.write_audit_log();
create trigger audit_stock_transactions after insert or update or delete on public.stock_transactions for each row execute function public.write_audit_log();
create trigger audit_renewals after insert or update or delete on public.renewals for each row execute function public.write_audit_log();
create trigger audit_purchase_requests after insert or update or delete on public.purchase_requests for each row execute function public.write_audit_log();
create trigger audit_settings after update on public.app_settings for each row execute function public.write_audit_log();

alter table public.renewals enable row level security;
alter table public.purchase_requests enable row level security;
alter table public.purchase_request_lines enable row level security;
alter table public.renewal_history enable row level security;
alter table public.app_settings enable row level security;
alter table public.audit_logs enable row level security;

create policy "renewals read authenticated" on public.renewals for select to authenticated using(true);
create policy "purchase requests read authenticated" on public.purchase_requests for select to authenticated using(true);
create policy "purchase requests manage staff" on public.purchase_requests for all to authenticated using(public.current_role() in ('admin','staff')) with check(public.current_role() in ('admin','staff'));
create policy "purchase lines read authenticated" on public.purchase_request_lines for select to authenticated using(true);
create policy "purchase lines manage staff" on public.purchase_request_lines for all to authenticated using(public.current_role() in ('admin','staff')) with check(public.current_role() in ('admin','staff'));
create policy "renewals manage staff" on public.renewals for all to authenticated using(public.current_role() in ('admin','staff')) with check(public.current_role() in ('admin','staff'));
create policy "renewal history read authenticated" on public.renewal_history for select to authenticated using(true);
create policy "renewal history insert staff" on public.renewal_history for insert to authenticated with check(public.current_role() in ('admin','staff'));
create policy "settings read authenticated" on public.app_settings for select to authenticated using(true);
create policy "settings manage admin" on public.app_settings for all to authenticated using(public.current_role()='admin') with check(public.current_role()='admin');
create policy "audit read admin" on public.audit_logs for select to authenticated using(public.current_role()='admin');

revoke insert,update,delete on public.audit_logs from authenticated;
