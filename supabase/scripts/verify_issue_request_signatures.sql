-- Read-only verification after 202610010001_issue_request_signatures.sql.
-- Every row should return true.
with checks as (
  select 'signature column exists' check_name,exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='issue_requests' and column_name='signature_path'
  ) passed
  union all select 'private signature bucket exists',exists(
    select 1 from storage.buckets where id='issue-signatures' and not public
      and file_size_limit=200000 and allowed_mime_types @> array['image/png']
  )
  union all select 'signed create request RPC exists',
    to_regprocedure('public.create_issue_request(text,text,text,jsonb,text)') is not null
  union all select 'legacy unsigned request RPC removed',
    to_regprocedure('public.create_issue_request(text,text,text,jsonb)') is null
  union all select 'orphan signature cleanup RPC exists',
    to_regprocedure('public.cleanup_issue_signature(text)') is not null
  union all select 'signature path cannot be reused',
    to_regclass('public.issue_requests_signature_path_key') is not null
  union all select 'signature storage policies exist',(
    select count(*)=2 from pg_policies
    where schemaname='storage' and tablename='objects'
      and policyname in ('issue signatures upload own','issue signatures read permitted')
  )
)
select check_name,passed from checks order by check_name;
