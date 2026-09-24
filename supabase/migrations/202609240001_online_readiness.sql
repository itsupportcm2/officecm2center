-- Online-readiness hardening. Run after 202609230001_hardening.sql.

begin;

alter table public.items
  add column if not exists primary_location_id uuid references public.locations(id) on delete restrict;

alter table public.stock_transactions
  add column if not exists approved_by text,
  add column if not exists supplier text;

update public.items i
set primary_location_id = chosen.location_id
from (
  select distinct on (item_id) item_id, location_id
  from public.stock_balances
  order by item_id, quantity desc, location_id
) chosen
where chosen.item_id = i.id and i.primary_location_id is null;

create unique index if not exists items_barcode_unique_idx
  on public.items(barcode) where barcode is not null and trim(barcode) <> '';
create index if not exists items_primary_location_idx on public.items(primary_location_id);
create index if not exists transactions_reference_idx on public.stock_transactions(reference_no);

alter table public.profiles drop constraint if exists profiles_department_check;
alter table public.profiles add constraint profiles_department_check check (
  department is null or department in ('EC','HR','AP','AC','PC','IT','DC','LAB','R&D','QC','RM','PR','PA','ST','MC','SE','O&E','SERVICE')
);
alter table public.stock_transactions drop constraint if exists stock_transactions_department_check;
alter table public.stock_transactions add constraint stock_transactions_department_check check (
  department is null or department in ('EC','HR','AP','AC','PC','IT','DC','LAB','R&D','QC','RM','PR','PA','ST','MC','SE','O&E','SERVICE')
);
alter table public.renewals drop constraint if exists renewals_owner_check;
alter table public.renewals add constraint renewals_owner_check check (
  owner in ('EC','HR','AP','AC','PC','IT','DC','LAB','R&D','QC','RM','PR','PA','ST','MC','SE','O&E','SERVICE')
);

drop view if exists public.inventory_overview;
create view public.inventory_overview with (security_invoker=true) as
select i.*, i.primary_location_id as location_id, coalesce(total.quantity,0) as quantity
from public.items i
left join (
  select item_id, sum(quantity) as quantity
  from public.stock_balances
  group by item_id
) total on total.item_id = i.id;
grant select on public.inventory_overview to authenticated;

create or replace function public.create_inventory_item(
  p_sku text, p_name text, p_description text, p_category_id uuid,
  p_unit text, p_min_stock numeric, p_barcode text, p_image_url text,
  p_is_active boolean, p_location_id uuid
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_item_id uuid;
begin
  if auth.uid() is null or public.current_role() <> 'admin' then raise exception 'permission denied'; end if;
  if nullif(trim(p_sku),'') is null or nullif(trim(p_name),'') is null or nullif(trim(p_unit),'') is null then
    raise exception 'sku, name and unit are required';
  end if;
  if p_min_stock < 0 then raise exception 'minimum stock cannot be negative'; end if;
  insert into public.items(sku,name,description,category_id,unit,min_stock,barcode,image_url,is_active,primary_location_id)
  values(trim(p_sku),trim(p_name),coalesce(p_description,''),p_category_id,trim(p_unit),p_min_stock,
    nullif(trim(p_barcode),''),nullif(trim(p_image_url),''),p_is_active,p_location_id)
  returning id into v_item_id;
  insert into public.stock_balances(item_id,location_id,quantity) values(v_item_id,p_location_id,0);
  return v_item_id;
end $$;

create or replace function public.apply_stock_change_v2(
  p_item_id uuid, p_location_id uuid, p_type public.stock_transaction_type, p_quantity numeric,
  p_reference_no text default null, p_employee_name text default null, p_department text default null,
  p_purpose text default null, p_note text default null, p_approved_by text default null,
  p_supplier text default null
) returns public.stock_transactions language plpgsql security definer set search_path=public as $$
declare v_before numeric(14,2); v_after numeric(14,2); v_tx public.stock_transactions;
begin
  if auth.uid() is null or public.current_role() = 'viewer' then raise exception 'permission denied'; end if;
  if p_type not in ('IN','OUT') then raise exception 'unsupported transaction type'; end if;
  if p_quantity <= 0 then raise exception 'quantity must be greater than zero'; end if;
  if nullif(trim(p_reference_no),'') is null then raise exception 'reference is required'; end if;
  if p_type = 'IN' and nullif(trim(p_supplier),'') is null then raise exception 'supplier is required'; end if;
  if p_type = 'OUT' and (
    nullif(trim(p_employee_name),'') is null or nullif(trim(p_department),'') is null or nullif(trim(p_approved_by),'') is null
  ) then raise exception 'recipient, department and approver are required'; end if;
  insert into public.stock_balances(item_id,location_id,quantity) values(p_item_id,p_location_id,0)
    on conflict(item_id,location_id) do nothing;
  select quantity into v_before from public.stock_balances
    where item_id=p_item_id and location_id=p_location_id for update;
  v_after := case when p_type='IN' then v_before+p_quantity else v_before-p_quantity end;
  if v_after < 0 then raise exception 'insufficient stock'; end if;
  insert into public.stock_transactions(
    item_id,location_id,transaction_type,quantity,quantity_before,quantity_after,reference_no,
    employee_name,department,purpose,note,approved_by,supplier,created_by
  ) values(
    p_item_id,p_location_id,p_type,p_quantity,v_before,v_after,nullif(trim(p_reference_no),''),
    nullif(trim(p_employee_name),''),nullif(trim(p_department),''),nullif(trim(p_purpose),''),
    nullif(trim(p_note),''),nullif(trim(p_approved_by),''),nullif(trim(p_supplier),''),auth.uid()
  ) returning * into v_tx;
  update public.stock_balances set quantity=v_after where item_id=p_item_id and location_id=p_location_id;
  return v_tx;
end $$;

create or replace function public.stock_in_v2(
  p_item_id uuid,p_location_id uuid,p_quantity numeric,p_reference_no text default null,
  p_employee_name text default null,p_department text default null,p_purpose text default null,
  p_note text default null,p_approved_by text default null,p_supplier text default null
) returns public.stock_transactions language sql security definer set search_path=public as $$
  select public.apply_stock_change_v2(p_item_id,p_location_id,'IN',p_quantity,p_reference_no,p_employee_name,p_department,p_purpose,p_note,p_approved_by,p_supplier)
$$;

create or replace function public.stock_out_v2(
  p_item_id uuid,p_location_id uuid,p_quantity numeric,p_reference_no text default null,
  p_employee_name text default null,p_department text default null,p_purpose text default null,
  p_note text default null,p_approved_by text default null,p_supplier text default null
) returns public.stock_transactions language sql security definer set search_path=public as $$
  select public.apply_stock_change_v2(p_item_id,p_location_id,'OUT',p_quantity,p_reference_no,p_employee_name,p_department,p_purpose,p_note,p_approved_by,p_supplier)
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,full_name,employee_code,department,role)
  values(
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'),''),split_part(new.email,'@',1),'User'),
    nullif(trim(new.raw_user_meta_data->>'employee_code'),''),
    case when new.raw_user_meta_data->>'department' in ('EC','HR','AP','AC','PC','IT','DC','LAB','R&D','QC','RM','PR','PA','ST','MC','SE','O&E','SERVICE')
      then new.raw_user_meta_data->>'department' else null end,
    'viewer'
  ) on conflict(id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

drop policy if exists "profiles self update" on public.profiles;
drop policy if exists "profiles admin manage" on public.profiles;
create policy "profiles admin manage" on public.profiles for all to authenticated
  using(public.current_role()='admin') with check(public.current_role()='admin');
revoke insert,update,delete on public.profiles from authenticated;
grant insert,update,delete on public.profiles to authenticated;

create or replace function public.update_own_profile(p_full_name text)
returns public.profiles language plpgsql security definer set search_path=public as $$
declare v_profile public.profiles;
begin
  if auth.uid() is null or nullif(trim(p_full_name),'') is null then raise exception 'invalid profile'; end if;
  update public.profiles set full_name=trim(p_full_name) where id=auth.uid() returning * into v_profile;
  return v_profile;
end $$;

create or replace function public.enforce_purchase_request_write() returns trigger
language plpgsql security definer set search_path=public as $$
declare v_role public.app_role := public.current_role();
begin
  if v_role = 'admin' then return coalesce(new,old); end if;
  if v_role <> 'staff' then raise exception 'permission denied'; end if;
  if tg_op = 'INSERT' then
    if new.status <> 'DRAFT' or new.requested_by <> auth.uid() then raise exception 'staff can create only their own draft'; end if;
    return new;
  elsif tg_op = 'UPDATE' then
    if old.requested_by is distinct from auth.uid() then raise exception 'staff can update only their own request'; end if;
    if old.status <> 'DRAFT' or new.status not in ('DRAFT','SUBMITTED') then raise exception 'invalid request transition'; end if;
    if new.requested_by is distinct from old.requested_by or new.request_no is distinct from old.request_no then raise exception 'immutable request fields'; end if;
    return new;
  elsif tg_op = 'DELETE' then
    if old.requested_by is distinct from auth.uid() then raise exception 'staff can delete only their own request'; end if;
    if old.status <> 'DRAFT' then raise exception 'only drafts can be deleted'; end if;
    return old;
  end if;
  return coalesce(new,old);
end $$;

drop trigger if exists enforce_purchase_request_write_trigger on public.purchase_requests;
create trigger enforce_purchase_request_write_trigger before insert or update or delete on public.purchase_requests
for each row execute function public.enforce_purchase_request_write();

create or replace function public.enforce_purchase_line_write() returns trigger
language plpgsql security definer set search_path=public as $$
declare v_request_id uuid := coalesce(new.request_id,old.request_id); v_status text; v_requested_by uuid;
begin
  if public.current_role() = 'admin' then return coalesce(new,old); end if;
  if public.current_role() <> 'staff' then raise exception 'permission denied'; end if;
  select status,requested_by into v_status,v_requested_by from public.purchase_requests where id=v_request_id;
  if v_status <> 'DRAFT' or v_requested_by is distinct from auth.uid() then
    raise exception 'staff can change only lines in their own draft';
  end if;
  return coalesce(new,old);
end $$;

drop trigger if exists enforce_purchase_line_write_trigger on public.purchase_request_lines;
create trigger enforce_purchase_line_write_trigger before insert or update or delete on public.purchase_request_lines
for each row execute function public.enforce_purchase_line_write();

create or replace function public.renew_renewal(
  p_renewal_id uuid, p_cost numeric default null, p_evidence_url text default null, p_note text default null
) returns public.renewals language plpgsql security definer set search_path=public as $$
declare v_item public.renewals; v_new_date date;
begin
  if auth.uid() is null or public.current_role() = 'viewer' then raise exception 'permission denied'; end if;
  select * into v_item from public.renewals where id=p_renewal_id for update;
  if not found then raise exception 'renewal not found'; end if;
  v_new_date := case when v_item.cycle_unit='month'
    then (v_item.expiry_date + make_interval(months=>v_item.cycle_count))::date
    else (v_item.expiry_date + make_interval(years=>v_item.cycle_count))::date end;
  insert into public.renewal_history(renewal_id,previous_expiry_date,new_expiry_date,cost,evidence_url,note,renewed_by)
  values(v_item.id,v_item.expiry_date,v_new_date,p_cost,nullif(trim(p_evidence_url),''),nullif(trim(p_note),''),auth.uid());
  update public.renewals set expiry_date=v_new_date,last_renewed_at=now() where id=v_item.id returning * into v_item;
  return v_item;
end $$;

revoke all on function public.current_role() from public;
revoke all on function public.create_inventory_item(text,text,text,uuid,text,numeric,text,text,boolean,uuid) from public;
revoke all on function public.apply_stock_change_v2(uuid,uuid,public.stock_transaction_type,numeric,text,text,text,text,text,text,text) from public;
revoke all on function public.stock_in_v2(uuid,uuid,numeric,text,text,text,text,text,text,text) from public;
revoke all on function public.stock_out_v2(uuid,uuid,numeric,text,text,text,text,text,text,text) from public;
revoke all on function public.update_own_profile(text) from public;
revoke all on function public.renew_renewal(uuid,numeric,text,text) from public;
grant execute on function public.current_role() to authenticated;
grant execute on function public.create_inventory_item(text,text,text,uuid,text,numeric,text,text,boolean,uuid) to authenticated;
grant execute on function public.stock_in_v2(uuid,uuid,numeric,text,text,text,text,text,text,text) to authenticated;
grant execute on function public.stock_out_v2(uuid,uuid,numeric,text,text,text,text,text,text,text) to authenticated;
grant execute on function public.update_own_profile(text) to authenticated;
grant execute on function public.renew_renewal(uuid,numeric,text,text) to authenticated;

-- Keep internal helpers callable only through their guarded public wrappers/triggers.
revoke all on function public.apply_stock_change(uuid,uuid,public.stock_transaction_type,numeric,text,text,text,text,text) from public,authenticated;
revoke all on function public.stock_in(uuid,uuid,numeric,text,text,text,text,text) from public,authenticated;
revoke all on function public.stock_out(uuid,uuid,numeric,text,text,text,text,text) from public,authenticated;
revoke all on function public.apply_stock_change_v2(uuid,uuid,public.stock_transaction_type,numeric,text,text,text,text,text,text,text) from authenticated;
revoke all on function public.write_audit_log() from public,authenticated;
revoke all on function public.handle_new_user() from public,authenticated;
revoke all on function public.enforce_purchase_request_write() from public,authenticated;
revoke all on function public.enforce_purchase_line_write() from public,authenticated;

commit;
