-- Read-only verification after 202610010002_issue_request_line_notes.sql.
-- Every row should return true.
with checks as (
  select 'issue request line note column exists' check_name,exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='issue_request_lines' and column_name='note'
  ) passed
  union all select 'line note length guard exists',exists(
    select 1 from pg_constraint
    where conname='issue_request_lines_note_length'
      and conrelid='public.issue_request_lines'::regclass
  )
  union all select 'create request stores line note',coalesce((
    select position('v_line_note' in pg_get_functiondef(p.oid))>0
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='create_issue_request'
      and pg_get_function_identity_arguments(p.oid)='p_recipient_name text, p_department text, p_note text, p_lines jsonb, p_signature_path text'
  ),false)
  union all select 'request list returns line note',coalesce((
    select position('''note'', l.note' in pg_get_functiondef(p.oid))>0
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='get_issue_requests'
      and pg_get_function_identity_arguments(p.oid)=''
  ),false)
  union all select 'approval copies line note to stock history',coalesce((
    select position('v_line.note' in pg_get_functiondef(p.oid))>0
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='review_issue_request'
      and pg_get_function_identity_arguments(p.oid)='p_request_id uuid, p_decision text, p_rejection_reason text'
  ),false)
)
select check_name,passed from checks order by check_name;
