-- Allow active admin/staff users to rename categories through a guarded RPC.
begin;

revoke update on public.categories from anon,authenticated;

create or replace function public.update_inventory_category(
  p_category_id uuid,
  p_name text,
  p_description text default ''
) returns public.categories
language plpgsql security definer set search_path=public as $$
declare
  v_old public.categories;
  v_category public.categories;
begin
  if auth.uid() is null or public.current_role() not in ('admin','staff') then
    raise exception 'permission denied';
  end if;
  if p_category_id is null then raise exception 'category is required'; end if;
  if nullif(trim(p_name),'') is null then raise exception 'category name is required'; end if;

  select * into v_old from public.categories where id=p_category_id for update;
  if not found then raise exception 'category not found'; end if;

  if exists(
    select 1 from public.categories
    where id<>p_category_id and lower(trim(name))=lower(trim(p_name))
  ) then
    raise exception 'category name already exists';
  end if;

  update public.categories
  set name=trim(p_name),description=coalesce(trim(p_description),'')
  where id=p_category_id
  returning * into v_category;

  insert into public.audit_logs(
    table_name,record_id,action,old_data,new_data,actor_id,event_type,title,detail
  ) values(
    'categories',v_category.id::text,'UPDATE',to_jsonb(v_old),to_jsonb(v_category),auth.uid(),
    'UPDATE',v_category.name,concat('เปลี่ยนชื่อหมวดหมู่จาก ',v_old.name,' เป็น ',v_category.name)
  );

  return v_category;
end $$;

revoke all on function public.update_inventory_category(uuid,text,text) from public;
grant execute on function public.update_inventory_category(uuid,text,text) to authenticated;

commit;
