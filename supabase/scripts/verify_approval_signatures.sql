-- Read-only verification after 202610080003_approval_signatures.sql.
-- Every row should return true.
with checks as (
  select 'approval signature column exists' check_name,exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='issue_requests'
      and column_name='approval_signature_path'
  ) passed
  union all select 'private approval signature bucket exists',exists(
    select 1 from storage.buckets
    where id='approval-signatures' and not public
      and file_size_limit=200000 and allowed_mime_types @> array['image/png']
  )
  union all select 'signed review RPC exists',
    to_regprocedure('public.review_issue_request(uuid,text,text,text)') is not null
  union all select 'legacy unsigned review RPC removed',
    to_regprocedure('public.review_issue_request(uuid,text,text)') is null
  union all select 'approval signature is required for approval',coalesce((
    select position('valid approval signature is required' in pg_get_functiondef(p.oid))>0
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='review_issue_request'
      and pg_get_function_identity_arguments(p.oid)='p_request_id uuid, p_decision text, p_rejection_reason text, p_approval_signature_path text'
  ),false)
  union all select 'orphan approval signature cleanup RPC exists',
    to_regprocedure('public.cleanup_approval_signature(text)') is not null
  union all select 'approval signature path cannot be reused',
    to_regclass('public.issue_requests_approval_signature_path_key') is not null
  union all select 'approval signature storage policies exist',(
    select count(*)=2 from pg_policies
    where schemaname='storage' and tablename='objects'
      and policyname in ('approval signatures upload operators','approval signatures read permitted')
  )
)
select check_name,passed from checks order by check_name;
