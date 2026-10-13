-- Add the personnel and visa-issue details used by the existing migrant-worker register.
begin;

alter table public.foreign_workers
  add column if not exists organization_unit text not null default '' check (char_length(organization_unit) <= 200),
  add column if not exists title text not null default '' check (char_length(title) <= 50),
  add column if not exists national_id text not null default '' check (char_length(national_id) <= 30),
  add column if not exists birth_date date;

alter table public.migrant_worker_documents
  add column if not exists visa_issued_on date;

do $$ begin
  alter table public.migrant_worker_documents
    add constraint migrant_worker_documents_visa_date_order
    check (visa_expires_on is null or visa_issued_on is null or visa_expires_on >= visa_issued_on);
exception when duplicate_object then null;
end $$;

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
  p_is_active boolean default true
) returns public.foreign_workers language plpgsql security definer set search_path=public as $$
declare v_old public.foreign_workers; v_worker public.foreign_workers;
begin
  perform public.assert_migrant_document_manager();
  if nullif(trim(p_employee_code),'') is null or nullif(trim(p_full_name),'') is null then
    raise exception 'employee code and name are required';
  end if;
  if p_department not in ('EC','HR','AP','AC','PC','IT','DC','LAB','R&D','QC','RM','PR','PA','ST','MC','SE','O&E','SERVICE') then
    raise exception 'invalid department';
  end if;
  if p_worker_id is null then
    insert into public.foreign_workers(employee_code,full_name,nationality,department,organization_unit,title,national_id,birth_date,position,note,is_active)
    values(trim(p_employee_code),trim(p_full_name),trim(p_nationality),p_department,trim(p_organization_unit),trim(p_title),trim(p_national_id),p_birth_date,trim(p_position),trim(p_note),coalesce(p_is_active,true))
    returning * into v_worker;
    insert into public.audit_logs(table_name,record_id,action,new_data,actor_id,event_type,title,detail)
    values('foreign_workers',v_worker.id::text,'INSERT',to_jsonb(v_worker),auth.uid(),'MIGRANT_WORKER_CREATE',v_worker.full_name,'เพิ่มข้อมูลแรงงานต่างด้าว');
  else
    select * into v_old from public.foreign_workers where id=p_worker_id for update;
    if not found then raise exception 'worker not found'; end if;
    if exists(select 1 from public.foreign_workers where id<>p_worker_id and employee_code=trim(p_employee_code)) then raise exception 'employee code already exists'; end if;
    update public.foreign_workers set employee_code=trim(p_employee_code),full_name=trim(p_full_name),nationality=trim(p_nationality),department=p_department,organization_unit=trim(p_organization_unit),title=trim(p_title),national_id=trim(p_national_id),birth_date=p_birth_date,position=trim(p_position),note=trim(p_note),is_active=coalesce(p_is_active,true)
    where id=p_worker_id returning * into v_worker;
    insert into public.audit_logs(table_name,record_id,action,old_data,new_data,actor_id,event_type,title,detail)
    values('foreign_workers',v_worker.id::text,'UPDATE',to_jsonb(v_old),to_jsonb(v_worker),auth.uid(),'MIGRANT_WORKER_UPDATE',v_worker.full_name,'แก้ไขข้อมูลแรงงานต่างด้าว');
  end if;
  return v_worker;
end $$;

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
  p_is_active boolean default true
) returns public.migrant_worker_documents language plpgsql security definer set search_path=public as $$
declare v_old public.migrant_worker_documents; v_document public.migrant_worker_documents; v_action text;
begin
  perform public.assert_migrant_document_manager();
  if p_worker_id is null or not exists(select 1 from public.foreign_workers where id=p_worker_id) then raise exception 'worker not found'; end if;
  if p_document_type not in ('PASSPORT_RED','PASSPORT_GREEN','PINK_CARD','TEN_YEAR_CARD','WORK_PERMIT') then raise exception 'invalid document type'; end if;
  if nullif(trim(p_document_number),'') is null then raise exception 'document number is required'; end if;
  if p_remind_days not between 0 and 365 then raise exception 'invalid reminder days'; end if;
  if p_document_id is null then
    insert into public.migrant_worker_documents(worker_id,document_type,document_number,issued_on,expires_on,visa_issued_on,visa_expires_on,area_permit_issued_on,area_permit_expires_on,remind_days,note,is_active)
    values(p_worker_id,p_document_type,trim(p_document_number),p_issued_on,p_expires_on,p_visa_issued_on,p_visa_expires_on,p_area_permit_issued_on,p_area_permit_expires_on,p_remind_days,trim(p_note),coalesce(p_is_active,true)) returning * into v_document;
    v_action:='CREATE';
  else
    select * into v_old from public.migrant_worker_documents where id=p_document_id for update;
    if not found then raise exception 'document not found'; end if;
    update public.migrant_worker_documents set worker_id=p_worker_id,document_type=p_document_type,document_number=trim(p_document_number),issued_on=p_issued_on,expires_on=p_expires_on,visa_issued_on=p_visa_issued_on,visa_expires_on=p_visa_expires_on,area_permit_issued_on=p_area_permit_issued_on,area_permit_expires_on=p_area_permit_expires_on,remind_days=p_remind_days,note=trim(p_note),is_active=coalesce(p_is_active,true)
    where id=p_document_id returning * into v_document;
    v_action:=case when coalesce(v_document.expires_on,'-infinity'::date)>coalesce(v_old.expires_on,'-infinity'::date) or coalesce(v_document.visa_expires_on,'-infinity'::date)>coalesce(v_old.visa_expires_on,'-infinity'::date) or coalesce(v_document.area_permit_expires_on,'-infinity'::date)>coalesce(v_old.area_permit_expires_on,'-infinity'::date) then 'RENEW' else 'UPDATE' end;
  end if;
  insert into public.migrant_worker_document_history(document_id,action,previous_data,new_data,note,changed_by)
  values(v_document.id,v_action,case when p_document_id is null then null else to_jsonb(v_old) end,to_jsonb(v_document),nullif(trim(p_note),''),auth.uid());
  insert into public.audit_logs(table_name,record_id,action,old_data,new_data,actor_id,event_type,title,detail)
  values('migrant_worker_documents',v_document.id::text,case when p_document_id is null then 'INSERT' else 'UPDATE' end,case when p_document_id is null then null else to_jsonb(v_old) end,to_jsonb(v_document),auth.uid(),case when v_action='RENEW' then 'MIGRANT_DOCUMENT_RENEW' else 'MIGRANT_DOCUMENT_'||v_action end,v_document.document_number,case when v_action='RENEW' then 'ต่ออายุเอกสารแรงงานต่างด้าว' else 'บันทึกเอกสารแรงงานต่างด้าว' end);
  return v_document;
end $$;

revoke all on function public.save_foreign_worker_details(uuid,text,text,text,text,text,text,text,date,text,text,boolean) from public;
revoke all on function public.save_migrant_worker_document_details(uuid,uuid,text,text,date,date,date,date,date,date,integer,text,boolean) from public;
grant execute on function public.save_foreign_worker_details(uuid,text,text,text,text,text,text,text,date,text,text,boolean) to authenticated;
grant execute on function public.save_migrant_worker_document_details(uuid,uuid,text,text,date,date,date,date,date,date,integer,text,boolean) to authenticated;

commit;
