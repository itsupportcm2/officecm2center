-- Integrate work permit fields into migrant_worker_documents table
-- and streamline document types to 4 main identity documents.
begin;

-- 1. Add work permit columns
alter table public.migrant_worker_documents
  add column if not exists work_permit_number text not null default '',
  add column if not exists work_permit_issued_on date,
  add column if not exists work_permit_expires_on date;

-- 2. Date order constraint for work permit
do $$ begin
  alter table public.migrant_worker_documents
    add constraint migrant_worker_documents_work_permit_date_order
    check (work_permit_expires_on is null or work_permit_issued_on is null or work_permit_expires_on >= work_permit_issued_on);
exception when duplicate_object then null;
end $$;

-- 3. Index for work permit expiry reminders
create index if not exists migrant_worker_documents_work_permit_expiry_idx
  on public.migrant_worker_documents(work_permit_expires_on)
  where is_active and work_permit_expires_on is not null;

-- 4. Migrate existing WORK_PERMIT rows into the primary document row of the same worker (if any)
do $$
declare
  r record;
  target_id uuid;
begin
  for r in (
    select id, worker_id, coalesce(document_number,'') as doc_num, issued_on, expires_on
    from public.migrant_worker_documents
    where document_type = 'WORK_PERMIT' and is_active = true
  ) loop
    -- Find active primary document for this worker
    select id into target_id
    from public.migrant_worker_documents
    where worker_id = r.worker_id
      and document_type in ('PASSPORT_RED','PASSPORT_GREEN','PINK_CARD','TEN_YEAR_CARD')
      and is_active = true
    order by created_at desc
    limit 1;

    if target_id is not null then
      update public.migrant_worker_documents
      set work_permit_number = coalesce(nullif(r.doc_num, ''), work_permit_number),
          work_permit_issued_on = coalesce(r.issued_on, work_permit_issued_on),
          work_permit_expires_on = coalesce(r.expires_on, work_permit_expires_on)
      where id = target_id;

      -- Deactivate standalone WORK_PERMIT row since it is now merged
      update public.migrant_worker_documents
      set is_active = false,
          note = trim(note || ' [รวมเข้ากับเอกสารหลักแล้ว]')
      where id = r.id;
    end if;
  end loop;
end $$;

-- 5. Relax table check constraints to allow work permit columns and optional document types
alter table public.migrant_worker_documents
  drop constraint if exists migrant_worker_documents_check;

-- Add updated check constraint
alter table public.migrant_worker_documents
  add constraint migrant_worker_documents_check
  check (
    (document_type in ('PASSPORT_RED','PASSPORT_GREEN') and issued_on is not null and expires_on is not null and visa_expires_on is not null and area_permit_issued_on is null and area_permit_expires_on is null)
    or (document_type='PINK_CARD' and issued_on is not null and expires_on is not null and visa_expires_on is null and area_permit_issued_on is null and area_permit_expires_on is null)
    or (document_type='TEN_YEAR_CARD' and issued_on is not null and expires_on is not null and visa_expires_on is null and area_permit_issued_on is not null and area_permit_expires_on is not null)
    or (document_type='WORK_PERMIT')
  );

-- 6. Update save_migrant_worker_document_details RPC
create or replace function public.save_migrant_worker_document_details(
  p_document_id uuid default null,
  p_worker_id uuid default null,
  p_document_type text default '',
  p_document_number text default '',
  p_issued_on date default null,
  p_expires_on date default null,
  p_visa_issued_on date default null,
  p_visa_expires_on date default null,
  p_area_permit_issued_on date default null,
  p_area_permit_expires_on date default null,
  p_remind_days integer default 30,
  p_note text default '',
  p_is_active boolean default true,
  p_work_permit_number text default '',
  p_work_permit_issued_on date default null,
  p_work_permit_expires_on date default null
) returns public.migrant_worker_documents language plpgsql security definer set search_path=public as $$
declare
  v_old public.migrant_worker_documents;
  v_document public.migrant_worker_documents;
  v_action text;
  v_number text;
begin
  perform public.assert_migrant_document_manager();
  if p_worker_id is null or not exists(select 1 from public.foreign_workers where id=p_worker_id) then
    raise exception 'worker not found';
  end if;
  if p_document_type not in ('PASSPORT_RED','PASSPORT_GREEN','PINK_CARD','TEN_YEAR_CARD','WORK_PERMIT') then
    raise exception 'invalid document type';
  end if;
  v_number := nullif(trim(p_document_number),'');
  if p_document_type <> 'WORK_PERMIT' and v_number is null then
    raise exception 'document number is required';
  end if;
  if p_remind_days not between 0 and 365 then
    raise exception 'invalid reminder days';
  end if;

  if p_document_id is null then
    insert into public.migrant_worker_documents(
      worker_id,
      document_type,
      document_number,
      issued_on,
      expires_on,
      visa_issued_on,
      visa_expires_on,
      area_permit_issued_on,
      area_permit_expires_on,
      remind_days,
      note,
      is_active,
      work_permit_number,
      work_permit_issued_on,
      work_permit_expires_on
    )
    values(
      p_worker_id,
      p_document_type,
      v_number,
      p_issued_on,
      p_expires_on,
      p_visa_issued_on,
      p_visa_expires_on,
      p_area_permit_issued_on,
      p_area_permit_expires_on,
      p_remind_days,
      trim(p_note),
      coalesce(p_is_active, true),
      coalesce(trim(p_work_permit_number), ''),
      p_work_permit_issued_on,
      p_work_permit_expires_on
    ) returning * into v_document;
    v_action := 'CREATE';
  else
    select * into v_old from public.migrant_worker_documents where id = p_document_id for update;
    if not found then raise exception 'document not found'; end if;
    update public.migrant_worker_documents set
      worker_id = p_worker_id,
      document_type = p_document_type,
      document_number = v_number,
      issued_on = p_issued_on,
      expires_on = p_expires_on,
      visa_issued_on = p_visa_issued_on,
      visa_expires_on = p_visa_expires_on,
      area_permit_issued_on = p_area_permit_issued_on,
      area_permit_expires_on = p_area_permit_expires_on,
      remind_days = p_remind_days,
      note = trim(p_note),
      is_active = coalesce(p_is_active, true),
      work_permit_number = coalesce(trim(p_work_permit_number), ''),
      work_permit_issued_on = p_work_permit_issued_on,
      work_permit_expires_on = p_work_permit_expires_on
    where id = p_document_id returning * into v_document;

    v_action := case
      when coalesce(v_document.expires_on,'-infinity'::date) > coalesce(v_old.expires_on,'-infinity'::date)
        or coalesce(v_document.visa_expires_on,'-infinity'::date) > coalesce(v_old.visa_expires_on,'-infinity'::date)
        or coalesce(v_document.area_permit_expires_on,'-infinity'::date) > coalesce(v_old.area_permit_expires_on,'-infinity'::date)
        or coalesce(v_document.work_permit_expires_on,'-infinity'::date) > coalesce(v_old.work_permit_expires_on,'-infinity'::date)
      then 'RENEW'
      else 'UPDATE'
    end;
  end if;

  insert into public.migrant_worker_document_history(document_id,action,previous_data,new_data,note,changed_by)
  values(v_document.id,v_action,case when p_document_id is null then null else to_jsonb(v_old) end,to_jsonb(v_document),nullif(trim(p_note),''),auth.uid());

  insert into public.audit_logs(table_name,record_id,action,old_data,new_data,actor_id,event_type,title,detail)
  values(
    'migrant_worker_documents',
    v_document.id::text,
    case when p_document_id is null then 'INSERT' else 'UPDATE' end,
    case when p_document_id is null then null else to_jsonb(v_old) end,
    to_jsonb(v_document),
    auth.uid(),
    case when v_action='RENEW' then 'MIGRANT_DOCUMENT_RENEW' else 'MIGRANT_DOCUMENT_'||v_action end,
    coalesce(v_document.document_number, v_document.work_permit_number, 'เอกสารแรงงานต่างด้าว'),
    case when v_action='RENEW' then 'ต่ออายุเอกสารแรงงานต่างด้าว' else 'บันทึกเอกสารแรงงานต่างด้าว' end
  );

  return v_document;
end $$;

revoke all on function public.save_migrant_worker_document_details(uuid,uuid,text,text,date,date,date,date,date,date,integer,text,boolean,text,date,date) from public;
grant execute on function public.save_migrant_worker_document_details(uuid,uuid,text,text,date,date,date,date,date,date,integer,text,boolean,text,date,date) to authenticated;

commit;
