-- Read-only verification after 202609300002_performance_bootstrap.sql.
-- Every row should return true.
with checks as (
  select 'operator stock snapshot RPC exists' check_name,
    to_regprocedure('public.get_operator_stock_snapshot()') is not null passed
  union all
  select 'authenticated can execute snapshot RPC',
    has_function_privilege('authenticated','public.get_operator_stock_snapshot()','EXECUTE')
  union all
  select 'snapshot RPC is security definer',coalesce((
    select p.prosecdef
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='get_operator_stock_snapshot'
      and pg_get_function_identity_arguments(p.oid)=''
  ),false)
)
select check_name,passed from checks order by check_name;
