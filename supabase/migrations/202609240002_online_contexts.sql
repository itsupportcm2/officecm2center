-- Data adapters for renewals, purchase requests, settings and audit log.
-- Run after 202609240001_online_readiness.sql.

begin;

alter table public.audit_logs
  add column if not exists event_type text,
  add column if not exists title text,
  add column if not exists detail text;

create sequence if not exists public.purchase_request_no_seq;

create or replace function public.create_purchase_request(p_note text, p_lines jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_request_id uuid; v_request_no text; v_line jsonb;
begin
  if auth.uid() is null or public.current_role() not in ('admin','staff') then raise exception 'permission denied'; end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'at least one request line is required';
  end if;
  v_request_no := 'PR-' || to_char(current_timestamp at time zone 'Asia/Bangkok','YYYYMMDD') || '-' ||
    lpad(nextval('public.purchase_request_no_seq')::text,5,'0');
  insert into public.purchase_requests(request_no,status,note,requested_by)
  values(v_request_no,'DRAFT',coalesce(p_note,''),auth.uid()) returning id into v_request_id;
  for v_line in select value from jsonb_array_elements(p_lines) loop
    insert into public.purchase_request_lines(request_id,item_id,quantity,unit)
    select v_request_id,i.id,(v_line->>'quantity')::numeric,i.unit
    from public.items i where i.id=(v_line->>'item_id')::uuid;
    if not found then raise exception 'item not found'; end if;
  end loop;
  return v_request_id;
end $$;

create or replace function public.record_app_audit(
  p_event_type text, p_entity text, p_entity_id text, p_title text, p_detail text
) returns bigint language plpgsql security definer set search_path=public as $$
declare v_id bigint;
begin
  if auth.uid() is null then raise exception 'permission denied'; end if;
  if p_event_type not in ('BACKUP','RESTORE') then raise exception 'unsupported audit event'; end if;
  insert into public.audit_logs(table_name,record_id,action,event_type,title,detail,actor_id)
  values(coalesce(nullif(trim(p_entity),''),'system'),nullif(trim(p_entity_id),''),'INSERT',p_event_type,p_title,p_detail,auth.uid())
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.write_audit_log() returns trigger
language plpgsql security definer set search_path=public as $$
declare v_event text; v_title text; v_detail text; v_record_id text;
begin
  v_record_id := case when tg_op='DELETE' then old.id::text else new.id::text end;
  v_event := case
    when tg_table_name='stock_transactions' and tg_op='INSERT' then 'STOCK_' || new.transaction_type::text
    when tg_table_name='purchase_requests' and tg_op='INSERT' then 'PURCHASE_CREATE'
    when tg_table_name='purchase_requests' and tg_op='UPDATE' then 'PURCHASE_UPDATE'
    when tg_table_name='renewals' and tg_op='UPDATE' and new.last_renewed_at is distinct from old.last_renewed_at then 'RENEW'
    when tg_table_name='app_settings' then 'SETTINGS'
    else tg_op
  end;
  v_title := case
    when tg_table_name='items' then coalesce(new.name,old.name)
    when tg_table_name='renewals' then coalesce(new.name,old.name)
    when tg_table_name='purchase_requests' then coalesce(new.request_no,old.request_no)
    when tg_table_name='stock_transactions' then coalesce(new.reference_no,new.id::text)
    when tg_table_name='app_settings' then 'System settings'
    else tg_table_name
  end;
  v_detail := case
    when tg_table_name='stock_transactions' then concat(new.transaction_type,' ',new.quantity,'; reference ',coalesce(new.reference_no,'-'))
    when tg_table_name='purchase_requests' and tg_op='UPDATE' then concat('Status ',old.status,' -> ',new.status)
    when tg_table_name='renewals' and tg_op='UPDATE' then concat('Expiry ',old.expiry_date,' -> ',new.expiry_date)
    else concat(tg_op,' ',tg_table_name)
  end;
  insert into public.audit_logs(table_name,record_id,action,old_data,new_data,actor_id,event_type,title,detail)
  values(tg_table_name,v_record_id,tg_op,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end,
    auth.uid(),v_event,v_title,v_detail);
  return case when tg_op='DELETE' then old else new end;
end $$;

revoke all on function public.create_purchase_request(text,jsonb) from public;
revoke all on function public.record_app_audit(text,text,text,text,text) from public;
grant execute on function public.create_purchase_request(text,jsonb) to authenticated;
grant execute on function public.record_app_audit(text,text,text,text,text) to authenticated;

commit;
