begin;

drop policy if exists "staff insert categories" on public.categories;
create policy "staff insert categories" on public.categories for insert to authenticated
  with check(public.current_role()='staff');

commit;
