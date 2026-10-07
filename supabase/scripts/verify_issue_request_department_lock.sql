-- Read-only verification after 202610070001_lock_issue_request_department.sql.
-- Every row should return true.
with request_function as (
  select pg_get_functiondef(p.oid) definition
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname='create_issue_request'
    and pg_get_function_identity_arguments(p.oid)='p_recipient_name text, p_department text, p_note text, p_lines jsonb, p_signature_path text'
), checks as (
  select 'create request RPC exists' check_name,exists(select 1 from request_function) passed
  union all select 'department loaded from active profile',coalesce((
    select position('v_profile_department' in lower(definition))>0
      and position('from public.profiles' in lower(definition))>0
      and position('is_active' in lower(definition))>0
    from request_function
  ),false)
  union all select 'submitted department must match profile',coalesce((
    select position('request department must match user profile' in lower(definition))>0
      and position('p_department' in lower(definition))>0
      and position('v_profile_department' in lower(definition))>0
    from request_function
  ),false)
  union all select 'profile department is stored on request',coalesce((
    select position('v_profile_department' in definition)>0
      and position('insert into public.issue_requests' in lower(definition))>0
    from request_function
  ),false)
  union all select 'authenticated can execute create request RPC',
    has_function_privilege('authenticated','public.create_issue_request(text,text,text,jsonb,text)','EXECUTE')
)
select check_name,passed from checks order by check_name;
