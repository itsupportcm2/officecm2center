-- Reduce operator startup latency by returning the inventory and stock history
-- needed by the application in one guarded database round trip.
begin;

create or replace function public.get_operator_stock_snapshot() returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null
     or not public.is_current_user_active()
     or public.current_role() not in ('admin','staff') then
    raise exception 'permission denied';
  end if;

  select jsonb_build_object(
    'items',coalesce((
      select jsonb_agg(
        to_jsonb(i) || jsonb_build_object(
          'location_id',i.primary_location_id,
          'quantity',coalesce((
            select sum(b.quantity) from public.stock_balances b where b.item_id=i.id
          ),0)
        ) order by i.created_at desc
      )
      from public.items i
    ),'[]'::jsonb),
    'categories',coalesce((
      select jsonb_agg(to_jsonb(c) order by c.name) from public.categories c
    ),'[]'::jsonb),
    'locations',coalesce((
      select jsonb_agg(to_jsonb(l) order by l.name) from public.locations l
    ),'[]'::jsonb),
    'balances',coalesce((
      select jsonb_agg(to_jsonb(b) order by b.item_id,b.location_id)
      from public.stock_balances b
    ),'[]'::jsonb),
    'transactions',coalesce((
      select jsonb_agg(
        to_jsonb(t) || jsonb_build_object(
          'created_by_name',coalesce(p.full_name,'ผู้ใช้งาน')
        ) order by t.created_at desc
      )
      from public.stock_transactions t
      left join public.profiles p on p.id=t.created_by
    ),'[]'::jsonb)
  ) into v_result;

  return v_result;
end $$;

revoke all on function public.get_operator_stock_snapshot() from public;
grant execute on function public.get_operator_stock_snapshot() to authenticated;

commit;
