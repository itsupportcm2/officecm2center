-- Add real phone column on foreign_workers and create transactional RPCs for deleting workers and documents.
begin;

-- 1. Add dedicated phone column & backfill phone numbers previously stored in organization_unit
alter table public.foreign_workers
  add column if not exists phone text not null default '' check (char_length(phone) <= 50);

update public.foreign_workers
set phone = trim(organization_unit),
    organization_unit = ''
where phone = ''
  and organization_unit ~ '^[0-9+\-\s()]{7,30}$';

-- 2. Replace 12-param save_foreign_worker_details with 13-param version supporting p_phone
-- Drop old signature first to avoid ambiguous overload in PostgreSQL / PostgREST
drop function if exists public.save_foreign_worker_details(uuid,text,text,text,text,text,text,text,date,text,text,boolean);

create or replace function public.save_foreign_worker_details(
  p_worker_id uuid default null,
  p_employee_code text default '',
  p_full_name text default '',
  p_nationality text default '',
  p_department text default '',
  p_organization_unit text default '',
  p_title text default '',
  p_national_id text default '',
  p_birth_date date default null,
  p_position text default '',
  p_note text default '',
  p_is_active boolean default true,
  p_phone text default ''
) returns public.foreign_workers language plpgsql security definer set search_path=public as $$
declare
  v_old public.foreign_workers;
  v_worker public.foreign_workers;
begin
  perform public.assert_migrant_document_manager();

  if nullif(trim(p_employee_code), '') is null or nullif(trim(p_full_name), '') is null then
    raise exception 'employee code and name are required';
  end if;
  if p_department not in ('EC','HR','AP','AC','PC','IT','DC','LAB','R&D','QC','RM','PR','PA','ST','MC','SE','O&E','SERVICE') then
    raise exception 'invalid department';
  end if;

  if p_worker_id is null then
    if exists(select 1 from public.foreign_workers where employee_code = trim(p_employee_code)) then
      raise exception 'employee code already exists';
    end if;

    insert into public.foreign_workers(
      employee_code,
      full_name,
      nationality,
      department,
      organization_unit,
      phone,
      title,
      national_id,
      birth_date,
      position,
      note,
      is_active
    )
    values(
      trim(p_employee_code),
      trim(p_full_name),
      trim(coalesce(p_nationality, '')),
      p_department,
      trim(coalesce(p_organization_unit, '')),
      trim(coalesce(p_phone, '')),
      trim(coalesce(p_title, '')),
      trim(coalesce(p_national_id, '')),
      p_birth_date,
      trim(coalesce(p_position, '')),
      trim(coalesce(p_note, '')),
      coalesce(p_is_active, true)
    )
    returning * into v_worker;

    insert into public.audit_logs(table_name, record_id, action, new_data, actor_id, event_type, title, detail)
    values('foreign_workers', v_worker.id::text, 'INSERT', to_jsonb(v_worker), auth.uid(), 'MIGRANT_WORKER_CREATE', v_worker.full_name, 'เพิ่มข้อมูลแรงงานต่างด้าว');
  else
    select * into v_old from public.foreign_workers where id = p_worker_id for update;
    if not found then
      raise exception 'worker not found';
    end if;
    if exists(select 1 from public.foreign_workers where id <> p_worker_id and employee_code = trim(p_employee_code)) then
      raise exception 'employee code already exists';
    end if;

    update public.foreign_workers
    set employee_code = trim(p_employee_code),
        full_name = trim(p_full_name),
        nationality = trim(coalesce(p_nationality, '')),
        department = p_department,
        organization_unit = trim(coalesce(p_organization_unit, '')),
        phone = trim(coalesce(p_phone, '')),
        title = trim(coalesce(p_title, '')),
        national_id = trim(coalesce(p_national_id, '')),
        birth_date = p_birth_date,
        position = trim(coalesce(p_position, '')),
        note = trim(coalesce(p_note, '')),
        is_active = coalesce(p_is_active, true)
    where id = p_worker_id
    returning * into v_worker;

    insert into public.audit_logs(table_name, record_id, action, old_data, new_data, actor_id, event_type, title, detail)
    values('foreign_workers', v_worker.id::text, 'UPDATE', to_jsonb(v_old), to_jsonb(v_worker), auth.uid(), 'MIGRANT_WORKER_UPDATE', v_worker.full_name, 'แก้ไขข้อมูลแรงงานต่างด้าว');
  end if;

  return v_worker;
end $$;

-- 3. Transactional RPC to delete a migrant worker along with their documents and histories
create or replace function public.delete_foreign_worker(
  p_worker_id uuid
) returns void language plpgsql security definer set search_path=public as $$
declare
  v_worker public.foreign_workers;
begin
  perform public.assert_migrant_document_manager();

  select * into v_worker from public.foreign_workers where id = p_worker_id for update;
  if not found then
    raise exception 'worker not found';
  end if;

  delete from public.migrant_worker_document_history
  where document_id in (
    select id from public.migrant_worker_documents where worker_id = p_worker_id
  );

  delete from public.migrant_worker_documents
  where worker_id = p_worker_id;

  delete from public.foreign_workers
  where id = p_worker_id;

  insert into public.audit_logs(table_name, record_id, action, old_data, actor_id, event_type, title, detail)
  values(
    'foreign_workers',
    v_worker.id::text,
    'DELETE',
    to_jsonb(v_worker),
    auth.uid(),
    'MIGRANT_WORKER_DELETE',
    v_worker.full_name,
    'ลบข้อมูลแรงงานต่างด้าวและเอกสารที่เกี่ยวข้อง'
  );
end $$;

-- 4. Transactional RPC to delete a single migrant worker document and its history
create or replace function public.delete_migrant_worker_document(
  p_document_id uuid
) returns void language plpgsql security definer set search_path=public as $$
declare
  v_doc public.migrant_worker_documents;
begin
  perform public.assert_migrant_document_manager();

  select * into v_doc from public.migrant_worker_documents where id = p_document_id for update;
  if not found then
    raise exception 'document not found';
  end if;

  delete from public.migrant_worker_document_history
  where document_id = p_document_id;

  delete from public.migrant_worker_documents
  where id = p_document_id;

  insert into public.audit_logs(table_name, record_id, action, old_data, actor_id, event_type, title, detail)
  values(
    'migrant_worker_documents',
    v_doc.id::text,
    'DELETE',
    to_jsonb(v_doc),
    auth.uid(),
    'MIGRANT_DOCUMENT_DELETE',
    coalesce(nullif(trim(v_doc.document_number), ''), nullif(trim(v_doc.work_permit_number), ''), 'เอกสารแรงงานต่างด้าว'),
    'ลบเอกสารแรงงานต่างด้าว'
  );
end $$;

revoke all on function public.save_foreign_worker_details(uuid,text,text,text,text,text,text,text,date,text,text,boolean,text) from public;
grant execute on function public.save_foreign_worker_details(uuid,text,text,text,text,text,text,text,date,text,text,boolean,text) to authenticated;

revoke all on function public.delete_foreign_worker(uuid) from public;
grant execute on function public.delete_foreign_worker(uuid) to authenticated;

revoke all on function public.delete_migrant_worker_document(uuid) from public;
grant execute on function public.delete_migrant_worker_document(uuid) to authenticated;

commit;
