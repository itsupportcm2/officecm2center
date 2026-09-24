-- Fix the generic audit trigger so it can safely handle rows from different tables.

begin;

create or replace function public.write_audit_log() returns trigger
language plpgsql security definer set search_path=public as $$
declare
  v_event text;
  v_title text;
  v_detail text;
  v_record_id text;
  v_old jsonb := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end;
  v_new jsonb := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end;
begin
  v_record_id := coalesce(v_new->>'id',v_old->>'id');
  v_event := case
    when tg_table_name='stock_transactions' and tg_op='INSERT' then 'STOCK_' || coalesce(v_new->>'transaction_type','UPDATE')
    when tg_table_name='purchase_requests' and tg_op='INSERT' then 'PURCHASE_CREATE'
    when tg_table_name='purchase_requests' and tg_op='UPDATE' then 'PURCHASE_UPDATE'
    when tg_table_name='renewals' and tg_op='UPDATE' and v_new->>'last_renewed_at' is distinct from v_old->>'last_renewed_at' then 'RENEW'
    when tg_table_name='app_settings' then 'SETTINGS'
    else tg_op
  end;
  v_title := case
    when tg_table_name in ('items','renewals') then coalesce(v_new->>'name',v_old->>'name',tg_table_name)
    when tg_table_name='purchase_requests' then coalesce(v_new->>'request_no',v_old->>'request_no',tg_table_name)
    when tg_table_name='stock_transactions' then coalesce(v_new->>'reference_no',v_record_id,tg_table_name)
    when tg_table_name='app_settings' then 'System settings'
    else tg_table_name
  end;
  v_detail := case
    when tg_table_name='stock_transactions' then concat(v_new->>'transaction_type',' ',v_new->>'quantity','; reference ',coalesce(v_new->>'reference_no','-'))
    when tg_table_name='purchase_requests' and tg_op='UPDATE' then concat('Status ',v_old->>'status',' -> ',v_new->>'status')
    when tg_table_name='renewals' and tg_op='UPDATE' then concat('Expiry ',v_old->>'expiry_date',' -> ',v_new->>'expiry_date')
    else concat(tg_op,' ',tg_table_name)
  end;
  insert into public.audit_logs(table_name,record_id,action,old_data,new_data,actor_id,event_type,title,detail)
  values(tg_table_name,v_record_id,tg_op,v_old,v_new,auth.uid(),v_event,v_title,v_detail);
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;

revoke all on function public.write_audit_log() from public,authenticated;

commit;
