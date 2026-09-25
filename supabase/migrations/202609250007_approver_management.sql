begin;

create table if not exists public.approvers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (nullif(trim(name),'') is not null),
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists approvers_updated_at on public.approvers;
create trigger approvers_updated_at before update on public.approvers
for each row execute function public.set_updated_at();

alter table public.approvers enable row level security;

drop policy if exists "approvers read active" on public.approvers;
create policy "approvers read active" on public.approvers for select to authenticated
  using(public.is_current_user_active() and (is_active or public.current_role()='admin'));

drop policy if exists "approvers insert admin" on public.approvers;
create policy "approvers insert admin" on public.approvers for insert to authenticated
  with check(public.current_role()='admin');

drop policy if exists "approvers update admin" on public.approvers;
create policy "approvers update admin" on public.approvers for update to authenticated
  using(public.current_role()='admin') with check(public.current_role()='admin');

grant select,insert,update on public.approvers to authenticated;

insert into public.approvers(name) values
  ('ณัฐพล พรหมดี'),
  ('กมลชนก วิเศษ'),
  ('สุภาวดี มีสุข'),
  ('วีรพล ตั้งมั่น')
on conflict(name) do nothing;

commit;
