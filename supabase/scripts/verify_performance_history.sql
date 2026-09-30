-- Read-only verification after 202609300003_performance_history.sql.
-- Every row should return true.
with checks as (
  select 'operator history RPC exists' check_name,
    to_regprocedure('public.get_operator_stock_history(uuid)') is not null passed
  union all
  select 'authenticated can execute history RPC',
    has_function_privilege('authenticated','public.get_operator_stock_history(uuid)','EXECUTE')
  union all
  select 'history RPC is security definer',coalesce((
    select p.prosecdef
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='get_operator_stock_history'
      and pg_get_function_identity_arguments(p.oid)='p_item_id uuid'
  ),false)
  union all
  select 'bootstrap transaction limit is active',coalesce((
    select position('limit 10' in lower(pg_get_functiondef(p.oid)))>0
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='get_operator_stock_snapshot'
      and pg_get_function_identity_arguments(p.oid)=''
  ),false)
  union all
  select 'transaction history indexes exist',
    to_regclass('public.stock_transactions_created_at_idx') is not null
    and to_regclass('public.stock_transactions_item_created_at_idx') is not null
)
select check_name,passed from checks order by check_name;
