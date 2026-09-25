begin;

alter table public.profiles
  add column if not exists is_active boolean not null default true;

create or replace function public.is_current_user_active() returns boolean
language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.profiles
    where id=auth.uid() and is_active
  )
$$;

create or replace function public.current_role() returns public.app_role
language sql stable security definer set search_path=public as $$
  select coalesce(
    (select role from public.profiles where id=auth.uid() and is_active),
    'viewer'::public.app_role
  )
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,full_name,employee_code,department,role,is_active)
  values(
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'),''),split_part(new.email,'@',1),'User'),
    nullif(trim(new.raw_user_meta_data->>'employee_code'),''),
    case when new.raw_user_meta_data->>'department' in ('EC','HR','AP','AC','PC','IT','DC','LAB','R&D','QC','RM','PR','PA','ST','MC','SE','O&E','SERVICE')
      then new.raw_user_meta_data->>'department' else null end,
    'viewer',
    true
  ) on conflict(id) do nothing;
  return new;
end $$;

drop policy if exists "profiles read authenticated" on public.profiles;
create policy "profiles read active" on public.profiles for select to authenticated
  using(public.is_current_user_active());

drop policy if exists "reference data read" on public.categories;
create policy "reference data read active" on public.categories for select to authenticated
  using(public.is_current_user_active());

drop policy if exists "locations read" on public.locations;
create policy "locations read active" on public.locations for select to authenticated
  using(public.is_current_user_active());

drop policy if exists "items read" on public.items;
create policy "items read active" on public.items for select to authenticated
  using(public.is_current_user_active());

drop policy if exists "balances read" on public.stock_balances;
create policy "balances read active" on public.stock_balances for select to authenticated
  using(public.is_current_user_active());

drop policy if exists "transactions read" on public.stock_transactions;
create policy "transactions read active" on public.stock_transactions for select to authenticated
  using(public.is_current_user_active());

drop policy if exists "renewals read authenticated" on public.renewals;
create policy "renewals read active" on public.renewals for select to authenticated
  using(public.is_current_user_active());

drop policy if exists "purchase requests read authenticated" on public.purchase_requests;
create policy "purchase requests read active" on public.purchase_requests for select to authenticated
  using(public.is_current_user_active());

drop policy if exists "purchase lines read authenticated" on public.purchase_request_lines;
create policy "purchase lines read active" on public.purchase_request_lines for select to authenticated
  using(public.is_current_user_active());

drop policy if exists "renewal history read authenticated" on public.renewal_history;
create policy "renewal history read active" on public.renewal_history for select to authenticated
  using(public.is_current_user_active());

drop policy if exists "settings read authenticated" on public.app_settings;
create policy "settings read active" on public.app_settings for select to authenticated
  using(public.is_current_user_active());

revoke all on function public.is_current_user_active() from public;
grant execute on function public.is_current_user_active() to authenticated;

commit;
