-- Read-only verification after 202609290002_issue_request_approval.sql.
-- Every row should return true.
with checks as (
  select 'request table exists' check_name,to_regclass('public.issue_requests') is not null passed
  union all select 'request line table exists',to_regclass('public.issue_request_lines') is not null
  union all select 'create request RPC exists',to_regprocedure('public.create_issue_request(text,text,text,jsonb)') is not null
  union all select 'list request RPC exists',to_regprocedure('public.get_issue_requests()') is not null
  union all select 'review request RPC exists',to_regprocedure('public.review_issue_request(uuid,text,text)') is not null
  union all select 'cancel request RPC exists',to_regprocedure('public.cancel_issue_request(uuid)') is not null
  union all select 'issuer direct stock guard exists',exists(
    select 1 from pg_trigger t join pg_proc p on p.oid=t.tgfoid
    where t.tgname='enforce_issuer_stock_scope_trigger' and not t.tgisinternal
      and position('submit an issue request for approval' in pg_get_functiondef(p.oid))>0
  )
  union all select 'authenticated has no raw request table access',
    not has_table_privilege('authenticated','public.issue_requests','SELECT')
    and not has_table_privilege('authenticated','public.issue_requests','INSERT')
    and not has_table_privilege('authenticated','public.issue_requests','UPDATE')
    and not has_table_privilege('authenticated','public.issue_requests','DELETE')
  union all select 'authenticated has no raw request line access',
    not has_table_privilege('authenticated','public.issue_request_lines','SELECT')
    and not has_table_privilege('authenticated','public.issue_request_lines','INSERT')
    and not has_table_privilege('authenticated','public.issue_request_lines','UPDATE')
    and not has_table_privilege('authenticated','public.issue_request_lines','DELETE')
)
select check_name,passed from checks order by check_name;
