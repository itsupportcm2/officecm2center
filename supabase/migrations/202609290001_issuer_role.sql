-- Add a dedicated least-privilege role for users who only issue stock.
-- The explicit commit is required before the new enum value can be used below.
alter type public.app_role add value if not exists 'issuer';
commit;

begin;

-- Product-level replacement: every former viewer becomes an issuer.
update public.profiles set role='issuer' where role='viewer';

-- Existing stock RPCs pre-date the issuer role and reject only the old viewer
-- role. Enforce the new boundary at the transaction table as defence in depth:
-- issuers may create OUT rows only, even if they call an old RPC directly.
create or replace function public.enforce_issuer_stock_scope() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if public.current_role()='issuer' and new.transaction_type<>'OUT' then
    raise exception 'issuer may issue stock only';
  end if;
  return new;
end $$;

drop trigger if exists enforce_issuer_stock_scope_trigger on public.stock_transactions;
create trigger enforce_issuer_stock_scope_trigger
before insert on public.stock_transactions
for each row execute function public.enforce_issuer_stock_scope();

-- Security-definer functions from older releases checked only the legacy viewer
-- role. These table guards prevent an issuer from using those functions to edit
-- master data, renewals or purchase requests outside the two allowed workflows.
create or replace function public.enforce_issuer_readonly_table() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if public.current_role()='issuer' then
    raise exception 'issuer has read-only access to this resource';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;

drop trigger if exists enforce_issuer_readonly_items on public.items;
create trigger enforce_issuer_readonly_items before insert or update or delete on public.items
for each row execute function public.enforce_issuer_readonly_table();
drop trigger if exists enforce_issuer_readonly_categories on public.categories;
create trigger enforce_issuer_readonly_categories before insert or update or delete on public.categories
for each row execute function public.enforce_issuer_readonly_table();
drop trigger if exists enforce_issuer_readonly_locations on public.locations;
create trigger enforce_issuer_readonly_locations before insert or update or delete on public.locations
for each row execute function public.enforce_issuer_readonly_table();
drop trigger if exists enforce_issuer_readonly_renewals on public.renewals;
create trigger enforce_issuer_readonly_renewals before insert or update or delete on public.renewals
for each row execute function public.enforce_issuer_readonly_table();
drop trigger if exists enforce_issuer_readonly_renewal_history on public.renewal_history;
create trigger enforce_issuer_readonly_renewal_history before insert or update or delete on public.renewal_history
for each row execute function public.enforce_issuer_readonly_table();
drop trigger if exists enforce_issuer_readonly_purchase_requests on public.purchase_requests;
create trigger enforce_issuer_readonly_purchase_requests before insert or update or delete on public.purchase_requests
for each row execute function public.enforce_issuer_readonly_table();
drop trigger if exists enforce_issuer_readonly_purchase_lines on public.purchase_request_lines;
create trigger enforce_issuer_readonly_purchase_lines before insert or update or delete on public.purchase_request_lines
for each row execute function public.enforce_issuer_readonly_table();
drop trigger if exists enforce_issuer_readonly_settings on public.app_settings;
create trigger enforce_issuer_readonly_settings before insert or update or delete on public.app_settings
for each row execute function public.enforce_issuer_readonly_table();
drop trigger if exists enforce_issuer_readonly_profiles on public.profiles;
create trigger enforce_issuer_readonly_profiles before insert or update or delete on public.profiles
for each row execute function public.enforce_issuer_readonly_table();

-- Make the inventory view respect the underlying RLS policies. Without this,
-- a granted view can expose internal average-cost fields to restricted roles.
alter view public.inventory_overview set (security_invoker=true);

-- Retire legacy stock endpoints that return the full transaction composite.
-- Current clients use stock_in_with_cost() and the restricted issue_stock().
revoke execute on function public.stock_in_v2(uuid,uuid,numeric,text,text,text,text,text,text,text) from authenticated;
revoke execute on function public.stock_out_v2(uuid,uuid,numeric,text,text,text,text,text,text,text) from authenticated;

create or replace function public.record_app_audit(
  p_event_type text,p_entity text,p_entity_id text,p_title text,p_detail text
) returns bigint language plpgsql security definer set search_path=public as $$
declare v_id bigint;
begin
  if auth.uid() is null or public.current_role()<>'admin' then raise exception 'permission denied'; end if;
  if p_event_type not in ('BACKUP','RESTORE') then raise exception 'unsupported audit event'; end if;
  insert into public.audit_logs(table_name,record_id,action,event_type,title,detail,actor_id)
  values(coalesce(nullif(trim(p_entity),''),'system'),nullif(trim(p_entity_id),''),'INSERT',p_event_type,p_title,p_detail,auth.uid())
  returning id into v_id;
  return v_id;
end $$;

-- Issuers can read only their own profile. Admin and staff retain directory access.
drop policy if exists "profiles read active" on public.profiles;
create policy "profiles read by role" on public.profiles for select to authenticated
  using(
    public.is_current_user_active()
    and (public.current_role() in ('admin','staff') or id=auth.uid())
  );

-- Raw inventory tables include internal fields such as average cost. Issuers receive
-- a deliberately limited catalog through get_issue_catalog() instead.
drop policy if exists "reference data read active" on public.categories;
create policy "reference data read operators" on public.categories for select to authenticated
  using(public.is_current_user_active() and public.current_role() in ('admin','staff'));

drop policy if exists "locations read active" on public.locations;
create policy "locations read operators" on public.locations for select to authenticated
  using(public.is_current_user_active() and public.current_role() in ('admin','staff'));

drop policy if exists "items read active" on public.items;
create policy "items read operators" on public.items for select to authenticated
  using(public.is_current_user_active() and public.current_role() in ('admin','staff'));

drop policy if exists "balances read active" on public.stock_balances;
create policy "balances read operators" on public.stock_balances for select to authenticated
  using(public.is_current_user_active() and public.current_role() in ('admin','staff'));

drop policy if exists "transactions read active" on public.stock_transactions;
create policy "transactions read operators" on public.stock_transactions for select to authenticated
  using(public.is_current_user_active() and public.current_role() in ('admin','staff'));

drop policy if exists "renewals read active" on public.renewals;
create policy "renewals read operators" on public.renewals for select to authenticated
  using(public.is_current_user_active() and public.current_role() in ('admin','staff'));

drop policy if exists "purchase requests read active" on public.purchase_requests;
create policy "purchase requests read operators" on public.purchase_requests for select to authenticated
  using(public.is_current_user_active() and public.current_role() in ('admin','staff'));

drop policy if exists "purchase lines read active" on public.purchase_request_lines;
create policy "purchase lines read operators" on public.purchase_request_lines for select to authenticated
  using(public.is_current_user_active() and public.current_role() in ('admin','staff'));

drop policy if exists "renewal history read active" on public.renewal_history;
create policy "renewal history read operators" on public.renewal_history for select to authenticated
  using(public.is_current_user_active() and public.current_role() in ('admin','staff'));

drop policy if exists "settings read active" on public.app_settings;
create policy "settings read operators" on public.app_settings for select to authenticated
  using(public.is_current_user_active() and public.current_role() in ('admin','staff'));

create or replace function public.get_issue_catalog() returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare v_result jsonb;
begin
  if auth.uid() is null or not public.is_current_user_active()
     or public.current_role() not in ('admin','staff','issuer') then
    raise exception 'permission denied';
  end if;

  select jsonb_build_object(
    'items',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',i.id,'sku',i.sku,'name',i.name,'unit',i.unit,'barcode',i.barcode,
        'primary_location_id',i.primary_location_id,'created_at',i.created_at,
        'quantity',coalesce(total.quantity,0)
      ) order by i.name)
      from public.items i
      left join (
        select item_id,sum(quantity) quantity from public.stock_balances group by item_id
      ) total on total.item_id=i.id
      where i.is_active
    ),'[]'::jsonb),
    'locations',coalesce((
      select jsonb_agg(jsonb_build_object('id',l.id,'name',l.name,'description',l.description) order by l.name)
      from public.locations l
    ),'[]'::jsonb),
    'balances',coalesce((
      select jsonb_agg(jsonb_build_object('item_id',b.item_id,'location_id',b.location_id,'quantity',b.quantity))
      from public.stock_balances b join public.items i on i.id=b.item_id where i.is_active
    ),'[]'::jsonb)
  ) into v_result;
  return v_result;
end $$;

create or replace function public.get_my_issue_history() returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare v_result jsonb;
begin
  if auth.uid() is null or not public.is_current_user_active() or public.current_role()<>'issuer' then
    raise exception 'permission denied';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',t.id,'item_id',t.item_id,'location_id',t.location_id,
    'transaction_type',t.transaction_type,'quantity',t.quantity,
    'quantity_before',t.quantity_before,'quantity_after',t.quantity_after,
    'employee_name',t.employee_name,'department',t.department,'note',t.note,
    'approved_by',t.approved_by,'created_at',t.created_at
  ) order by t.created_at desc),'[]'::jsonb)
  into v_result
  from public.stock_transactions t
  where t.created_by=auth.uid() and t.transaction_type='OUT';
  return v_result;
end $$;

create or replace function public.stock_out_with_cost(
  p_item_id uuid,p_location_id uuid,p_quantity numeric,p_employee_name text,
  p_department text,p_approved_by text,p_note text default null
) returns public.stock_transactions
language plpgsql security definer set search_path=public as $$
declare v_before numeric(14,2);v_after numeric(14,2);v_unit_cost numeric(14,4);v_tx public.stock_transactions;
begin
  if auth.uid() is null or not public.is_current_user_active()
     or public.current_role() not in ('admin','staff') then raise exception 'permission denied'; end if;
  if p_quantity<=0 then raise exception 'quantity must be greater than zero'; end if;
  if nullif(trim(p_employee_name),'') is null or nullif(trim(p_department),'') is null or nullif(trim(p_approved_by),'') is null then
    raise exception 'recipient, department and approver are required';
  end if;
  if not exists(select 1 from public.approvers where is_active and name=trim(p_approved_by)) then
    raise exception 'approver is not active or does not exist';
  end if;
  select average_unit_cost into v_unit_cost from public.items where id=p_item_id and is_active for update;
  if not found then raise exception 'active item not found'; end if;
  select quantity into v_before from public.stock_balances where item_id=p_item_id and location_id=p_location_id for update;
  if not found then raise exception 'stock balance not found'; end if;
  v_after:=v_before-p_quantity;
  if v_after<0 then raise exception 'insufficient stock'; end if;
  insert into public.stock_transactions(item_id,location_id,transaction_type,quantity,quantity_before,quantity_after,employee_name,department,note,approved_by,unit_cost,total_cost,created_by)
  values(p_item_id,p_location_id,'OUT',p_quantity,v_before,v_after,trim(p_employee_name),trim(p_department),nullif(trim(p_note),''),trim(p_approved_by),v_unit_cost,round(p_quantity*v_unit_cost,2),auth.uid()) returning * into v_tx;
  update public.stock_balances set quantity=v_after where item_id=p_item_id and location_id=p_location_id;
  return v_tx;
end $$;

-- Restricted issue endpoint: returns only the transaction id so an issuer cannot
-- obtain the internal unit_cost/total_cost columns from the composite return row.
create or replace function public.issue_stock(
  p_item_id uuid,p_location_id uuid,p_quantity numeric,p_employee_name text,
  p_department text,p_approved_by text,p_note text default null
) returns uuid
language plpgsql security definer set search_path=public as $$
declare v_before numeric(14,2);v_after numeric(14,2);v_unit_cost numeric(14,4);v_id uuid;
begin
  if auth.uid() is null or not public.is_current_user_active()
     or public.current_role() not in ('admin','staff','issuer') then raise exception 'permission denied'; end if;
  if p_quantity<=0 then raise exception 'quantity must be greater than zero'; end if;
  if nullif(trim(p_employee_name),'') is null or nullif(trim(p_department),'') is null or nullif(trim(p_approved_by),'') is null then
    raise exception 'recipient, department and approver are required';
  end if;
  if not exists(select 1 from public.approvers where is_active and name=trim(p_approved_by)) then
    raise exception 'approver is not active or does not exist';
  end if;
  select average_unit_cost into v_unit_cost from public.items where id=p_item_id and is_active for update;
  if not found then raise exception 'active item not found'; end if;
  select quantity into v_before from public.stock_balances where item_id=p_item_id and location_id=p_location_id for update;
  if not found then raise exception 'stock balance not found'; end if;
  v_after:=v_before-p_quantity;
  if v_after<0 then raise exception 'insufficient stock'; end if;
  insert into public.stock_transactions(item_id,location_id,transaction_type,quantity,quantity_before,quantity_after,employee_name,department,note,approved_by,unit_cost,total_cost,created_by)
  values(p_item_id,p_location_id,'OUT',p_quantity,v_before,v_after,trim(p_employee_name),trim(p_department),nullif(trim(p_note),''),trim(p_approved_by),v_unit_cost,round(p_quantity*v_unit_cost,2),auth.uid())
  returning id into v_id;
  update public.stock_balances set quantity=v_after where item_id=p_item_id and location_id=p_location_id;
  return v_id;
end $$;

revoke all on function public.get_issue_catalog() from public;
revoke all on function public.get_my_issue_history() from public;
revoke all on function public.issue_stock(uuid,uuid,numeric,text,text,text,text) from public;
revoke all on function public.enforce_issuer_stock_scope() from public;
revoke all on function public.enforce_issuer_readonly_table() from public;
grant execute on function public.get_issue_catalog() to authenticated;
grant execute on function public.get_my_issue_history() to authenticated;
grant execute on function public.issue_stock(uuid,uuid,numeric,text,text,text,text) to authenticated;

commit;
