-- Read-only verification after running 202609280001_go_live_hardening.sql.
-- Every row in the final result should be true.

with checks as (
  select 'authenticated cannot update profiles directly' as check_name,
    not has_table_privilege('authenticated', 'public.profiles', 'UPDATE') as passed
  union all
  select 'authenticated cannot update items directly',
    not has_table_privilege('authenticated', 'public.items', 'UPDATE')
  union all
  select 'authenticated cannot delete items directly',
    not has_table_privilege('authenticated', 'public.items', 'DELETE')
  union all
  select 'authenticated cannot delete renewals directly',
    not has_table_privilege('authenticated', 'public.renewals', 'DELETE')
  union all
  select 'update item RPC exists',
    to_regprocedure('public.update_inventory_item(uuid,text,text,text,uuid,text,numeric,text,text,boolean,uuid)') is not null
  union all
  select 'archive item RPC exists',
    to_regprocedure('public.archive_inventory_item(uuid)') is not null
  union all
  select 'atomic CSV import RPC exists',
    to_regprocedure('public.bulk_create_inventory_items(jsonb)') is not null
  union all
  select 'archive renewal RPC exists',
    to_regprocedure('public.archive_renewal(uuid)') is not null
  union all
  select 'inactive item stock guard exists',
    exists(
      select 1 from pg_trigger
      where tgname = 'enforce_active_stock_item_trigger' and not tgisinternal
    )
  union all
  select 'self profile update policy removed',
    not exists(
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles self update'
    )
)
select check_name, passed from checks order by check_name;
