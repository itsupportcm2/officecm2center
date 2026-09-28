begin;

-- Profiles are managed by the admin-only Edge Function. Users must never be able
-- to promote their own role or reactivate themselves through the REST API.
drop policy if exists "profiles self update" on public.profiles;
revoke update on public.profiles from anon,authenticated;

-- Product maintenance goes through guarded RPCs so staff cannot alter average_unit_cost.
drop policy if exists "staff update items" on public.items;
drop policy if exists "staff delete items" on public.items;
revoke update,delete on public.items from anon,authenticated;

create or replace function public.update_inventory_item(
  p_item_id uuid, p_sku text, p_name text, p_description text, p_category_id uuid,
  p_unit text, p_min_stock numeric, p_barcode text, p_image_url text,
  p_is_active boolean, p_location_id uuid
) returns public.items language plpgsql security definer set search_path=public as $$
declare v_item public.items;
begin
  if auth.uid() is null or public.current_role() not in ('admin','staff') then raise exception 'permission denied'; end if;
  if nullif(trim(p_sku),'') is null or nullif(trim(p_name),'') is null or nullif(trim(p_unit),'') is null then
    raise exception 'sku, name and unit are required';
  end if;
  if p_min_stock < 0 then raise exception 'minimum stock cannot be negative'; end if;
  update public.items set
    sku=trim(p_sku),name=trim(p_name),description=coalesce(p_description,''),category_id=p_category_id,
    unit=trim(p_unit),min_stock=p_min_stock,barcode=nullif(trim(p_barcode),''),
    image_url=nullif(trim(p_image_url),''),is_active=p_is_active,primary_location_id=p_location_id
  where id=p_item_id returning * into v_item;
  if not found then raise exception 'item not found'; end if;
  insert into public.stock_balances(item_id,location_id,quantity) values(p_item_id,p_location_id,0)
  on conflict(item_id,location_id) do nothing;
  return v_item;
end $$;

create or replace function public.archive_inventory_item(p_item_id uuid)
returns public.items language plpgsql security definer set search_path=public as $$
declare v_item public.items;
begin
  if auth.uid() is null or public.current_role() not in ('admin','staff') then raise exception 'permission denied'; end if;
  update public.items set is_active=false where id=p_item_id returning * into v_item;
  if not found then raise exception 'item not found'; end if;
  return v_item;
end $$;

create or replace function public.bulk_create_inventory_items(p_items jsonb)
returns integer language plpgsql security definer set search_path=public as $$
declare v_row jsonb; v_count integer:=0;
begin
  if auth.uid() is null or public.current_role() not in ('admin','staff') then raise exception 'permission denied'; end if;
  if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 or jsonb_array_length(p_items)>500 then
    raise exception 'items must contain between 1 and 500 rows';
  end if;
  for v_row in select value from jsonb_array_elements(p_items) loop
    perform public.create_inventory_item(
      v_row->>'sku',v_row->>'name',coalesce(v_row->>'description',''),(v_row->>'category_id')::uuid,
      v_row->>'unit',coalesce((v_row->>'min_stock')::numeric,0),v_row->>'barcode',v_row->>'image_url',
      coalesce((v_row->>'is_active')::boolean,true),(v_row->>'location_id')::uuid
    );
    v_count:=v_count+1;
  end loop;
  return v_count;
end $$;

-- Renewals with history are archived instead of deleted, preserving the audit trail.
revoke delete on public.renewals from anon,authenticated;
create or replace function public.archive_renewal(p_renewal_id uuid)
returns public.renewals language plpgsql security definer set search_path=public as $$
declare v_item public.renewals;
begin
  if auth.uid() is null or public.current_role() not in ('admin','staff') then raise exception 'permission denied'; end if;
  update public.renewals set is_active=false where id=p_renewal_id returning * into v_item;
  if not found then raise exception 'renewal not found'; end if;
  return v_item;
end $$;

-- Enforce that stock issues use an active approver configured by an administrator.
create or replace function public.stock_out_with_cost(
  p_item_id uuid,p_location_id uuid,p_quantity numeric,p_employee_name text,
  p_department text,p_approved_by text,p_note text default null
) returns public.stock_transactions
language plpgsql security definer set search_path=public as $$
declare v_before numeric(14,2);v_after numeric(14,2);v_unit_cost numeric(14,4);v_tx public.stock_transactions;
begin
  if auth.uid() is null or public.current_role()='viewer' then raise exception 'permission denied'; end if;
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

create or replace function public.enforce_active_stock_item() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from public.items where id=new.item_id and is_active) then
    raise exception 'stock transaction requires an active item';
  end if;
  return new;
end $$;
drop trigger if exists enforce_active_stock_item_trigger on public.stock_transactions;
create trigger enforce_active_stock_item_trigger before insert on public.stock_transactions
for each row execute function public.enforce_active_stock_item();

revoke all on function public.update_inventory_item(uuid,text,text,text,uuid,text,numeric,text,text,boolean,uuid) from public;
revoke all on function public.archive_inventory_item(uuid) from public;
revoke all on function public.bulk_create_inventory_items(jsonb) from public;
revoke all on function public.archive_renewal(uuid) from public;
revoke all on function public.enforce_active_stock_item() from public,authenticated;
grant execute on function public.update_inventory_item(uuid,text,text,text,uuid,text,numeric,text,text,boolean,uuid) to authenticated;
grant execute on function public.archive_inventory_item(uuid) to authenticated;
grant execute on function public.bulk_create_inventory_items(jsonb) to authenticated;
grant execute on function public.archive_renewal(uuid) to authenticated;

commit;
