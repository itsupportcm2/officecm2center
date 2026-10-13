-- Migrant-worker document management and expiry reminders.
-- This migration replaces the unrun employee-contract draft.
alter type public.app_role add value if not exists 'employee_document_officer';
commit;

begin;

create table public.foreign_workers (
  id uuid primary key default gen_random_uuid(),
  employee_code text not null unique check (nullif(trim(employee_code),'') is not null),
  full_name text not null check (nullif(trim(full_name),'') is not null),
  nationality text not null default '' check (char_length(nationality) <= 100),
  department text not null check (department in ('EC','HR','AP','AC','PC','IT','DC','LAB','R&D','QC','RM','PR','PA','ST','MC','SE','O&E','SERVICE')),
  position text not null default '' check (char_length(position) <= 200),
  note text not null default '' check (char_length(note) <= 2000),
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.migrant_worker_documents (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.foreign_workers(id) on delete restrict,
  document_type text not null check (document_type in ('PASSPORT_RED','PASSPORT_GREEN','PINK_CARD','TEN_YEAR_CARD','WORK_PERMIT')),
  document_number text not null check (nullif(trim(document_number),'') is not null),
  issued_on date,
  expires_on date,
  visa_expires_on date,
  area_permit_issued_on date,
  area_permit_expires_on date,
  remind_days integer not null default 30 check (remind_days between 0 and 365),
  note text not null default '' check (char_length(note) <= 2000),
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_on is null or issued_on is null or expires_on >= issued_on),
  check (area_permit_expires_on is null or area_permit_issued_on is null or area_permit_expires_on >= area_permit_issued_on),
  check (
    (document_type in ('PASSPORT_RED','PASSPORT_GREEN') and issued_on is not null and expires_on is not null and visa_expires_on is not null and area_permit_issued_on is null and area_permit_expires_on is null)
    or (document_type='PINK_CARD' and issued_on is not null and expires_on is not null and visa_expires_on is null and area_permit_issued_on is null and area_permit_expires_on is null)
    or (document_type='TEN_YEAR_CARD' and issued_on is not null and expires_on is not null and visa_expires_on is null and area_permit_issued_on is not null and area_permit_expires_on is not null)
    or (document_type='WORK_PERMIT' and issued_on is not null and expires_on is not null and visa_expires_on is null and area_permit_issued_on is null and area_permit_expires_on is null)
  ),
  check (document_type<>'PASSPORT_RED' or upper(trim(document_number)) ~ '^M'),
  check (document_type<>'PASSPORT_GREEN' or upper(trim(document_number)) ~ '^(CC|CA)')
);

create table public.migrant_worker_document_history (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.migrant_worker_documents(id) on delete restrict,
  action text not null check (action in ('CREATE','UPDATE','RENEW','DEACTIVATE')),
  previous_data jsonb,
  new_data jsonb not null,
  note text,
  changed_by uuid references auth.users(id) on delete set null default auth.uid(),
  changed_at timestamptz not null default now()
);

create unique index migrant_worker_one_active_identity_document_idx
  on public.migrant_worker_documents(worker_id)
  where is_active and document_type in ('PASSPORT_RED','PASSPORT_GREEN','PINK_CARD','TEN_YEAR_CARD');
create index migrant_worker_documents_expiry_idx on public.migrant_worker_documents(expires_on) where is_active;
create index migrant_worker_documents_visa_expiry_idx on public.migrant_worker_documents(visa_expires_on) where is_active and visa_expires_on is not null;
create index migrant_worker_documents_area_expiry_idx on public.migrant_worker_documents(area_permit_expires_on) where is_active and area_permit_expires_on is not null;
create index migrant_worker_document_history_idx on public.migrant_worker_document_history(document_id,changed_at desc);

create trigger foreign_workers_updated_at before update on public.foreign_workers for each row execute function public.set_updated_at();
create trigger migrant_worker_documents_updated_at before update on public.migrant_worker_documents for each row execute function public.set_updated_at();

alter table public.foreign_workers enable row level security;
alter table public.migrant_worker_documents enable row level security;
alter table public.migrant_worker_document_history enable row level security;
revoke all on public.foreign_workers,public.migrant_worker_documents,public.migrant_worker_document_history from authenticated;

create or replace function public.assert_migrant_document_manager() returns void
language plpgsql stable security definer set search_path=public as $$
begin
  if auth.uid() is null or not public.is_current_user_active()
     or public.current_role() not in ('admin','staff','employee_document_officer') then
    raise exception 'permission denied';
  end if;
end $$;

create or replace function public.get_migrant_worker_snapshot() returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare v_result jsonb;
begin
  perform public.assert_migrant_document_manager();
  select jsonb_build_object(
    'workers',coalesce((select jsonb_agg(to_jsonb(w) order by w.is_active desc,w.full_name) from public.foreign_workers w),'[]'::jsonb),
    'documents',coalesce((select jsonb_agg(to_jsonb(d) order by d.is_active desc,d.expires_on nulls last,d.created_at desc) from public.migrant_worker_documents d),'[]'::jsonb),
    'history',coalesce((select jsonb_agg(to_jsonb(h)||jsonb_build_object('changed_by_name',coalesce(p.full_name,'ผู้ใช้งาน')) order by h.changed_at desc) from public.migrant_worker_document_history h left join public.profiles p on p.id=h.changed_by),'[]'::jsonb)
  ) into v_result;
  return v_result;
end $$;

create or replace function public.save_foreign_worker(
  p_worker_id uuid default null,p_employee_code text default '',p_full_name text default '',p_nationality text default '',p_department text default '',p_position text default '',p_note text default '',p_is_active boolean default true
) returns public.foreign_workers language plpgsql security definer set search_path=public as $$
declare v_old public.foreign_workers;v_worker public.foreign_workers;
begin
  perform public.assert_migrant_document_manager();
  if nullif(trim(p_employee_code),'') is null or nullif(trim(p_full_name),'') is null then raise exception 'employee code and name are required'; end if;
  if p_department not in ('EC','HR','AP','AC','PC','IT','DC','LAB','R&D','QC','RM','PR','PA','ST','MC','SE','O&E','SERVICE') then raise exception 'invalid department'; end if;
  if p_worker_id is null then
    insert into public.foreign_workers(employee_code,full_name,nationality,department,position,note,is_active)
    values(trim(p_employee_code),trim(p_full_name),trim(p_nationality),p_department,trim(p_position),trim(p_note),coalesce(p_is_active,true)) returning * into v_worker;
    insert into public.audit_logs(table_name,record_id,action,new_data,actor_id,event_type,title,detail) values('foreign_workers',v_worker.id::text,'INSERT',to_jsonb(v_worker),auth.uid(),'MIGRANT_WORKER_CREATE',v_worker.full_name,'เพิ่มข้อมูลแรงงานต่างด้าว');
  else
    select * into v_old from public.foreign_workers where id=p_worker_id for update;
    if not found then raise exception 'worker not found'; end if;
    if exists(select 1 from public.foreign_workers where id<>p_worker_id and employee_code=trim(p_employee_code)) then raise exception 'employee code already exists'; end if;
    update public.foreign_workers set employee_code=trim(p_employee_code),full_name=trim(p_full_name),nationality=trim(p_nationality),department=p_department,position=trim(p_position),note=trim(p_note),is_active=coalesce(p_is_active,true) where id=p_worker_id returning * into v_worker;
    insert into public.audit_logs(table_name,record_id,action,old_data,new_data,actor_id,event_type,title,detail) values('foreign_workers',v_worker.id::text,'UPDATE',to_jsonb(v_old),to_jsonb(v_worker),auth.uid(),'MIGRANT_WORKER_UPDATE',v_worker.full_name,'แก้ไขข้อมูลแรงงานต่างด้าว');
  end if;
  return v_worker;
end $$;

create or replace function public.save_migrant_worker_document(
  p_document_id uuid default null,p_worker_id uuid default null,p_document_type text default '',p_document_number text default '',p_issued_on date default null,p_expires_on date default null,p_visa_expires_on date default null,p_area_permit_issued_on date default null,p_area_permit_expires_on date default null,p_remind_days integer default 30,p_note text default '',p_is_active boolean default true
) returns public.migrant_worker_documents language plpgsql security definer set search_path=public as $$
declare v_old public.migrant_worker_documents;v_document public.migrant_worker_documents;v_action text;
begin
  perform public.assert_migrant_document_manager();
  if p_worker_id is null or not exists(select 1 from public.foreign_workers where id=p_worker_id) then raise exception 'worker not found'; end if;
  if p_document_type not in ('PASSPORT_RED','PASSPORT_GREEN','PINK_CARD','TEN_YEAR_CARD','WORK_PERMIT') then raise exception 'invalid document type'; end if;
  if nullif(trim(p_document_number),'') is null then raise exception 'document number is required'; end if;
  if p_remind_days not between 0 and 365 then raise exception 'invalid reminder days'; end if;
  if p_document_id is null then
    insert into public.migrant_worker_documents(worker_id,document_type,document_number,issued_on,expires_on,visa_expires_on,area_permit_issued_on,area_permit_expires_on,remind_days,note,is_active)
    values(p_worker_id,p_document_type,trim(p_document_number),p_issued_on,p_expires_on,p_visa_expires_on,p_area_permit_issued_on,p_area_permit_expires_on,p_remind_days,trim(p_note),coalesce(p_is_active,true)) returning * into v_document;
    v_action:='CREATE';
  else
    select * into v_old from public.migrant_worker_documents where id=p_document_id for update;
    if not found then raise exception 'document not found'; end if;
    update public.migrant_worker_documents set worker_id=p_worker_id,document_type=p_document_type,document_number=trim(p_document_number),issued_on=p_issued_on,expires_on=p_expires_on,visa_expires_on=p_visa_expires_on,area_permit_issued_on=p_area_permit_issued_on,area_permit_expires_on=p_area_permit_expires_on,remind_days=p_remind_days,note=trim(p_note),is_active=coalesce(p_is_active,true) where id=p_document_id returning * into v_document;
    v_action:=case when coalesce(v_document.expires_on,'-infinity'::date)>coalesce(v_old.expires_on,'-infinity'::date) or coalesce(v_document.visa_expires_on,'-infinity'::date)>coalesce(v_old.visa_expires_on,'-infinity'::date) or coalesce(v_document.area_permit_expires_on,'-infinity'::date)>coalesce(v_old.area_permit_expires_on,'-infinity'::date) then 'RENEW' else 'UPDATE' end;
  end if;
  insert into public.migrant_worker_document_history(document_id,action,previous_data,new_data,note,changed_by) values(v_document.id,v_action,case when p_document_id is null then null else to_jsonb(v_old) end,to_jsonb(v_document),nullif(trim(p_note),''),auth.uid());
  insert into public.audit_logs(table_name,record_id,action,old_data,new_data,actor_id,event_type,title,detail) values('migrant_worker_documents',v_document.id::text,case when p_document_id is null then 'INSERT' else 'UPDATE' end,case when p_document_id is null then null else to_jsonb(v_old) end,to_jsonb(v_document),auth.uid(),case when v_action='RENEW' then 'MIGRANT_DOCUMENT_RENEW' else 'MIGRANT_DOCUMENT_'||v_action end,v_document.document_number,case when v_action='RENEW' then 'ต่ออายุเอกสารแรงงานต่างด้าว' else 'บันทึกเอกสารแรงงานต่างด้าว' end);
  return v_document;
end $$;

revoke all on function public.assert_migrant_document_manager() from public;
revoke all on function public.get_migrant_worker_snapshot() from public;
revoke all on function public.save_foreign_worker(uuid,text,text,text,text,text,text,boolean) from public;
revoke all on function public.save_migrant_worker_document(uuid,uuid,text,text,date,date,date,date,date,integer,text,boolean) from public;
grant execute on function public.assert_migrant_document_manager() to authenticated;
grant execute on function public.get_migrant_worker_snapshot() to authenticated;
grant execute on function public.save_foreign_worker(uuid,text,text,text,text,text,text,boolean) to authenticated;
grant execute on function public.save_migrant_worker_document(uuid,uuid,text,text,date,date,date,date,date,integer,text,boolean) to authenticated;

commit;
