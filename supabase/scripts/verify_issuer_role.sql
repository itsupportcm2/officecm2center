-- Read-only verification after 202609290001_issuer_role.sql.
-- Every row should return true.
with checks as (
  select 'issuer enum exists' check_name,
    exists(select 1 from pg_enum e join pg_type t on t.oid=e.enumtypid where t.typname='app_role' and e.enumlabel='issuer') passed
  union all select 'former viewers migrated',not exists(select 1 from public.profiles where role='viewer')
  union all select 'issue catalog RPC exists',to_regprocedure('public.get_issue_catalog()') is not null
  union all select 'own history RPC exists',to_regprocedure('public.get_my_issue_history()') is not null
  union all select 'restricted issue RPC exists',to_regprocedure('public.issue_stock(uuid,uuid,numeric,text,text,text,text)') is not null
  union all select 'legacy stock v2 endpoints retired',
    not has_function_privilege('authenticated','public.stock_in_v2(uuid,uuid,numeric,text,text,text,text,text,text,text)','EXECUTE')
    and not has_function_privilege('authenticated','public.stock_out_v2(uuid,uuid,numeric,text,text,text,text,text,text,text)','EXECUTE')
  union all select 'issuer stock guard exists',exists(
    select 1 from pg_trigger where tgname='enforce_issuer_stock_scope_trigger' and not tgisinternal
  )
  union all select 'issuer write guards exist',(
    select count(*)=9 from pg_trigger
    where tgname like 'enforce_issuer_readonly_%' and not tgisinternal
  )
  union all select 'inventory view uses caller permissions',coalesce((
    select (c.reloptions @> array['security_invoker=true'])
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='inventory_overview'
  ),false)
  union all select 'transaction policy is operator only',exists(
    select 1 from pg_policies where schemaname='public' and tablename='stock_transactions' and policyname='transactions read operators'
  )
)
select check_name,passed from checks order by check_name;
