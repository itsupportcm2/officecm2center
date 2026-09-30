-- Read-only verification after 202609300001_update_categories.sql.
-- Every row should return true.
with checks as (
  select 'update category RPC exists' check_name,
    to_regprocedure('public.update_inventory_category(uuid,text,text)') is not null passed
  union all
  select 'authenticated can execute update category RPC',
    has_function_privilege('authenticated','public.update_inventory_category(uuid,text,text)','EXECUTE')
  union all
  select 'authenticated cannot update categories directly',
    not has_table_privilege('authenticated','public.categories','UPDATE')
)
select check_name,passed from checks order by check_name;
