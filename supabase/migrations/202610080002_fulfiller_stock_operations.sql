-- Give fulfillers the same four stock-operation capabilities as staff while
-- keeping master data, approvals, renewals and purchase requests restricted.
begin;

create or replace function public.enforce_issuer_readonly_table() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if public.current_role()='issuer'
     or (public.current_role()='fulfiller' and coalesce(current_setting('app.stock_operation',true),'')<>'true') then
    raise exception 'role has read-only access to this resource';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;

create or replace function public.stock_in_with_cost(
  p_item_id uuid,p_location_id uuid,p_quantity numeric,p_total_cost numeric,p_note text default null
) returns public.stock_transactions
language plpgsql security definer set search_path=public as $$
declare v_before numeric(14,2);v_after numeric(14,2);v_total_before numeric(14,2);v_old_average numeric(14,4);v_unit_cost numeric(14,4);v_new_average numeric(14,4);v_tx public.stock_transactions;
begin
  if auth.uid() is null or not public.is_current_user_active()
     or public.current_role() not in ('admin','staff','fulfiller') then raise exception 'permission denied'; end if;
  if p_quantity<=0 then raise exception 'quantity must be greater than zero'; end if;
  if p_total_cost is null or p_total_cost<0 then raise exception 'total cost must be zero or greater'; end if;
  perform set_config('app.stock_operation','true',true);
  select average_unit_cost into v_old_average from public.items where id=p_item_id and is_active for update;
  if not found then raise exception 'active item not found'; end if;
  select coalesce(sum(quantity),0) into v_total_before from public.stock_balances where item_id=p_item_id;
  insert into public.stock_balances(item_id,location_id,quantity) values(p_item_id,p_location_id,0) on conflict(item_id,location_id) do nothing;
  select quantity into v_before from public.stock_balances where item_id=p_item_id and location_id=p_location_id for update;
  v_after:=v_before+p_quantity;v_unit_cost:=round(p_total_cost/p_quantity,4);
  v_new_average:=round(((v_total_before*v_old_average)+p_total_cost)/(v_total_before+p_quantity),4);
  insert into public.stock_transactions(item_id,location_id,transaction_type,quantity,quantity_before,quantity_after,note,unit_cost,total_cost,created_by)
  values(p_item_id,p_location_id,'IN',p_quantity,v_before,v_after,nullif(trim(p_note),''),v_unit_cost,round(p_total_cost,2),auth.uid()) returning * into v_tx;
  update public.stock_balances set quantity=v_after where item_id=p_item_id and location_id=p_location_id;
  update public.items set average_unit_cost=v_new_average where id=p_item_id;
  return v_tx;
end $$;

create or replace function public.issue_stock(
  p_item_id uuid,p_location_id uuid,p_quantity numeric,p_employee_name text,
  p_department text,p_approved_by text,p_note text default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_before numeric(14,2);v_after numeric(14,2);v_unit_cost numeric(14,4);v_id uuid;
begin
  if auth.uid() is null or not public.is_current_user_active()
     or public.current_role() not in ('admin','staff','issuer','fulfiller') then raise exception 'permission denied'; end if;
  if p_quantity<=0 then raise exception 'quantity must be greater than zero'; end if;
  if nullif(trim(p_employee_name),'') is null or nullif(trim(p_department),'') is null or nullif(trim(p_approved_by),'') is null then raise exception 'recipient, department and approver are required'; end if;
  if not exists(select 1 from public.approvers where is_active and name=trim(p_approved_by)) then raise exception 'approver is not active or does not exist'; end if;
  select average_unit_cost into v_unit_cost from public.items where id=p_item_id and is_active for update;
  if not found then raise exception 'active item not found'; end if;
  select quantity into v_before from public.stock_balances where item_id=p_item_id and location_id=p_location_id for update;
  if not found then raise exception 'stock balance not found'; end if;
  v_after:=v_before-p_quantity;if v_after<0 then raise exception 'insufficient stock'; end if;
  insert into public.stock_transactions(item_id,location_id,transaction_type,quantity,quantity_before,quantity_after,employee_name,department,note,approved_by,unit_cost,total_cost,created_by)
  values(p_item_id,p_location_id,'OUT',p_quantity,v_before,v_after,trim(p_employee_name),trim(p_department),nullif(trim(p_note),''),trim(p_approved_by),v_unit_cost,round(p_quantity*v_unit_cost,2),auth.uid()) returning id into v_id;
  update public.stock_balances set quantity=v_after where item_id=p_item_id and location_id=p_location_id;
  return v_id;
end $$;

revoke all on function public.stock_in_with_cost(uuid,uuid,numeric,numeric,text) from public;
revoke all on function public.issue_stock(uuid,uuid,numeric,text,text,text,text) from public;
grant execute on function public.stock_in_with_cost(uuid,uuid,numeric,numeric,text) to authenticated;
grant execute on function public.issue_stock(uuid,uuid,numeric,text,text,text,text) to authenticated;

commit;
