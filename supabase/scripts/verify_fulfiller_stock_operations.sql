-- Read-only verification after 202610080002_fulfiller_stock_operations.sql.
-- Every row should return true.
with checks as (
  select 'stock in allows fulfiller' check_name,coalesce((select position('fulfiller' in pg_get_functiondef(p.oid))>0 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='stock_in_with_cost'),false) passed
  union all select 'direct issue allows fulfiller',coalesce((select position('fulfiller' in pg_get_functiondef(p.oid))>0 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='issue_stock'),false)
  union all select 'stock input uses guarded operation flag',coalesce((select position('app.stock_operation' in pg_get_functiondef(p.oid))>0 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='stock_in_with_cost'),false)
  union all select 'master data guard checks operation flag',coalesce((select position('app.stock_operation' in pg_get_functiondef(p.oid))>0 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='enforce_issuer_readonly_table'),false)
  union all select 'authenticated can call stock operations',
    has_function_privilege('authenticated','public.stock_in_with_cost(uuid,uuid,numeric,numeric,text)','EXECUTE')
    and has_function_privilege('authenticated','public.issue_stock(uuid,uuid,numeric,text,text,text,text)','EXECUTE')
    and has_function_privilege('authenticated','public.stock_adjust(uuid,uuid,numeric,text,text,text)','EXECUTE')
    and has_function_privilege('authenticated','public.stock_transfer(uuid,uuid,uuid,numeric,text,text,text)','EXECUTE')
)
select check_name,passed from checks order by check_name;
