-- Admin-only selective data purge RPC (single module at a time, never whole-app wipe).
begin;

create or replace function public.admin_purge_module_data(
  p_module text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted_a bigint := 0;
  v_deleted_b bigint := 0;
  v_deleted_c bigint := 0;
  v_summary jsonb;
  v_title text;
begin
  if auth.uid() is null
     or not public.is_current_user_active()
     or public.current_role() <> 'admin' then
    raise exception 'permission denied: admin only';
  end if;

  case p_module
    when 'migrant_workers' then
      delete from public.migrant_worker_document_history where id is not null;
      get diagnostics v_deleted_a = row_count;

      delete from public.migrant_worker_documents where id is not null;
      get diagnostics v_deleted_b = row_count;

      delete from public.foreign_workers where id is not null;
      get diagnostics v_deleted_c = row_count;

      v_title := 'ล้างข้อมูลต่อภาษีแรงงานต่างด้าว';
      v_summary := jsonb_build_object(
        'workers', v_deleted_c,
        'documents', v_deleted_b,
        'history', v_deleted_a
      );

    when 'renewals' then
      delete from public.renewal_history where id is not null;
      get diagnostics v_deleted_a = row_count;

      delete from public.renewals where id is not null;
      get diagnostics v_deleted_b = row_count;

      v_title := 'ล้างข้อมูลรายการต่ออายุสำนักงาน';
      v_summary := jsonb_build_object(
        'renewals', v_deleted_b,
        'history', v_deleted_a
      );

    when 'issue_requests' then
      delete from public.issue_request_lines where id is not null;
      get diagnostics v_deleted_a = row_count;

      delete from public.issue_requests where id is not null;
      get diagnostics v_deleted_b = row_count;

      v_title := 'ล้างข้อมูลคำขอเบิกสินค้า';
      v_summary := jsonb_build_object(
        'requests', v_deleted_b,
        'lines', v_deleted_a
      );

    when 'purchase_requests' then
      delete from public.purchase_request_lines where id is not null;
      get diagnostics v_deleted_a = row_count;

      delete from public.purchase_requests where id is not null;
      get diagnostics v_deleted_b = row_count;

      v_title := 'ล้างข้อมูลใบขอซื้อ';
      v_summary := jsonb_build_object(
        'requests', v_deleted_b,
        'lines', v_deleted_a
      );

    when 'stock_transactions' then
      delete from public.stock_transactions where id is not null;
      get diagnostics v_deleted_a = row_count;

      update public.stock_balances
      set quantity = 0
      where quantity <> 0;
      get diagnostics v_deleted_b = row_count;

      v_title := 'ล้างประวัติการเคลื่อนไหวสต็อกและรีเซ็ตยอดคงเหลือ';
      v_summary := jsonb_build_object(
        'transactions', v_deleted_a,
        'resetBalances', v_deleted_b
      );

    when 'audit_logs' then
      delete from public.audit_logs where id is not null;
      get diagnostics v_deleted_a = row_count;

      v_title := 'ล้างบันทึกกิจกรรม (Audit Log)';
      v_summary := jsonb_build_object(
        'logs', v_deleted_a
      );

    else
      raise exception 'invalid purge module';
  end case;

  insert into public.audit_logs(
    table_name,
    record_id,
    action,
    old_data,
    actor_id,
    event_type,
    title,
    detail
  )
  values(
    'admin_maintenance',
    p_module,
    'DELETE',
    v_summary,
    auth.uid(),
    'ADMIN_DATA_PURGE',
    v_title,
    'ผู้ดูแลระบบล้างข้อมูลเฉพาะหมวด ' || p_module
  );

  return jsonb_build_object(
    'module', p_module,
    'deleted', v_summary
  );
end $$;

revoke all on function public.admin_purge_module_data(text) from public;
grant execute on function public.admin_purge_module_data(text) to authenticated;

commit;
