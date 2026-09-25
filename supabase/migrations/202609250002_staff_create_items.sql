begin;

create or replace function public.create_inventory_item(
  p_sku text, p_name text, p_description text, p_category_id uuid,
  p_unit text, p_min_stock numeric, p_barcode text, p_image_url text,
  p_is_active boolean, p_location_id uuid
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_item_id uuid;
begin
  if auth.uid() is null or public.current_role() not in ('admin','staff') then
    raise exception 'permission denied';
  end if;
  if nullif(trim(p_sku),'') is null or nullif(trim(p_name),'') is null or nullif(trim(p_unit),'') is null then
    raise exception 'sku, name and unit are required';
  end if;
  if p_min_stock < 0 then raise exception 'minimum stock cannot be negative'; end if;
  insert into public.items(sku,name,description,category_id,unit,min_stock,barcode,image_url,is_active,primary_location_id)
  values(trim(p_sku),trim(p_name),coalesce(p_description,''),p_category_id,trim(p_unit),p_min_stock,
    nullif(trim(p_barcode),''),nullif(trim(p_image_url),''),p_is_active,p_location_id)
  returning id into v_item_id;
  insert into public.stock_balances(item_id,location_id,quantity) values(v_item_id,p_location_id,0);
  return v_item_id;
end $$;

revoke all on function public.create_inventory_item(text,text,text,uuid,text,numeric,text,text,boolean,uuid) from public;
grant execute on function public.create_inventory_item(text,text,text,uuid,text,numeric,text,text,boolean,uuid) to authenticated;

commit;
