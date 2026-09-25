begin;

drop policy if exists "staff update items" on public.items;
create policy "staff update items" on public.items for update to authenticated
  using(public.current_role()='staff')
  with check(public.current_role()='staff');

drop policy if exists "staff delete items" on public.items;
create policy "staff delete items" on public.items for delete to authenticated
  using(public.current_role()='staff');

commit;
