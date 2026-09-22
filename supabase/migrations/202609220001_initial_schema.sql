create extension if not exists pgcrypto;

create type public.app_role as enum ('admin','staff','viewer');
create type public.stock_transaction_type as enum ('IN','OUT','ADJUST','TRANSFER');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  employee_code text unique,
  department text,
  role public.app_role not null default 'viewer',
  created_at timestamptz not null default now()
);
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text not null default '',
  created_at timestamptz not null default now()
);
create table public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text not null default '',
  created_at timestamptz not null default now()
);
create table public.items (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  description text not null default '',
  category_id uuid not null references public.categories(id) on delete restrict,
  unit text not null,
  min_stock numeric(14,2) not null default 0 check (min_stock >= 0),
  barcode text,
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.stock_balances (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete restrict,
  location_id uuid not null references public.locations(id) on delete restrict,
  quantity numeric(14,2) not null default 0 check (quantity >= 0),
  updated_at timestamptz not null default now(),
  unique(item_id, location_id)
);
create table public.stock_transactions (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete restrict,
  location_id uuid not null references public.locations(id) on delete restrict,
  transaction_type public.stock_transaction_type not null,
  quantity numeric(14,2) not null check (quantity > 0),
  quantity_before numeric(14,2) not null check (quantity_before >= 0),
  quantity_after numeric(14,2) not null check (quantity_after >= 0),
  reference_no text,
  employee_name text,
  department text,
  purpose text,
  note text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index items_category_idx on public.items(category_id);
create index balances_item_idx on public.stock_balances(item_id);
create index balances_location_idx on public.stock_balances(location_id);
create index transactions_created_idx on public.stock_transactions(created_at desc);
create index transactions_item_idx on public.stock_transactions(item_id, created_at desc);
create index transactions_location_idx on public.stock_transactions(location_id);

create function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger items_updated_at before update on public.items for each row execute function public.set_updated_at();
create trigger balances_updated_at before update on public.stock_balances for each row execute function public.set_updated_at();

create function public.current_role() returns public.app_role language sql stable security definer set search_path=public as $$
  select coalesce((select role from public.profiles where id=auth.uid()), 'viewer'::public.app_role)
$$;

create or replace function public.apply_stock_change(
  p_item_id uuid, p_location_id uuid, p_type public.stock_transaction_type, p_quantity numeric,
  p_reference_no text default null, p_employee_name text default null, p_department text default null,
  p_purpose text default null, p_note text default null
) returns public.stock_transactions language plpgsql security definer set search_path=public as $$
declare v_before numeric(14,2); v_after numeric(14,2); v_tx public.stock_transactions;
begin
  if auth.uid() is null or public.current_role() = 'viewer' then raise exception 'permission denied'; end if;
  if p_type not in ('IN','OUT') then raise exception 'use a dedicated admin function for adjustments or transfers'; end if;
  if p_quantity <= 0 then raise exception 'quantity must be greater than zero'; end if;
  insert into public.stock_balances(item_id,location_id,quantity) values(p_item_id,p_location_id,0)
    on conflict(item_id,location_id) do nothing;
  select quantity into v_before from public.stock_balances where item_id=p_item_id and location_id=p_location_id for update;
  v_after := case when p_type='IN' then v_before+p_quantity else v_before-p_quantity end;
  if v_after < 0 then raise exception 'insufficient stock'; end if;
  insert into public.stock_transactions(item_id,location_id,transaction_type,quantity,quantity_before,quantity_after,reference_no,employee_name,department,purpose,note,created_by)
    values(p_item_id,p_location_id,p_type,p_quantity,v_before,v_after,p_reference_no,p_employee_name,p_department,p_purpose,p_note,auth.uid()) returning * into v_tx;
  update public.stock_balances set quantity=v_after where item_id=p_item_id and location_id=p_location_id;
  return v_tx;
end $$;

create function public.stock_in(p_item_id uuid,p_location_id uuid,p_quantity numeric,p_reference_no text default null,p_employee_name text default null,p_department text default null,p_purpose text default null,p_note text default null)
returns public.stock_transactions language sql security definer set search_path=public as $$ select public.apply_stock_change(p_item_id,p_location_id,'IN',p_quantity,p_reference_no,p_employee_name,p_department,p_purpose,p_note) $$;
create function public.stock_out(p_item_id uuid,p_location_id uuid,p_quantity numeric,p_reference_no text default null,p_employee_name text default null,p_department text default null,p_purpose text default null,p_note text default null)
returns public.stock_transactions language sql security definer set search_path=public as $$ select public.apply_stock_change(p_item_id,p_location_id,'OUT',p_quantity,p_reference_no,p_employee_name,p_department,p_purpose,p_note) $$;

create view public.inventory_overview with (security_invoker=true) as
select i.*, sb.location_id, coalesce(sb.quantity,0) quantity
from public.items i left join public.stock_balances sb on sb.item_id=i.id;

alter table public.profiles enable row level security; alter table public.categories enable row level security;
alter table public.locations enable row level security; alter table public.items enable row level security;
alter table public.stock_balances enable row level security; alter table public.stock_transactions enable row level security;
create policy "profiles read authenticated" on public.profiles for select to authenticated using(true);
create policy "profiles self update" on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
create policy "reference data read" on public.categories for select to authenticated using(true);
create policy "locations read" on public.locations for select to authenticated using(true);
create policy "items read" on public.items for select to authenticated using(true);
create policy "balances read" on public.stock_balances for select to authenticated using(true);
create policy "transactions read" on public.stock_transactions for select to authenticated using(true);
create policy "admins categories" on public.categories for all to authenticated using(public.current_role()='admin') with check(public.current_role()='admin');
create policy "admins locations" on public.locations for all to authenticated using(public.current_role()='admin') with check(public.current_role()='admin');
create policy "admins items" on public.items for all to authenticated using(public.current_role()='admin') with check(public.current_role()='admin');
revoke insert,update,delete on public.stock_balances,public.stock_transactions from authenticated;
grant execute on function public.stock_in to authenticated; grant execute on function public.stock_out to authenticated;
