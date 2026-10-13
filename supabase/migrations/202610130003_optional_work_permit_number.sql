-- The source register contains work-permit dates but not a work-permit number.
begin;

alter table public.migrant_worker_documents
  alter column document_number drop not null;
alter table public.migrant_worker_documents
  drop constraint if exists migrant_worker_documents_document_number_check;
alter table public.migrant_worker_documents
  drop constraint if exists migrant_worker_documents_document_number_by_type;
alter table public.migrant_worker_documents
  add constraint migrant_worker_documents_document_number_by_type
  check (document_type='WORK_PERMIT' or nullif(trim(document_number),'') is not null);

create or replace function public.save_migrant_worker_document_details(
  p_document_id uuid default null,p_worker_id uuid default null,p_document_type text default '',p_document_number text default '',p_issued_on date default null,p_expires_on date default null,p_visa_issued_on date default null,p_visa_expires_on date default null,p_area_permit_issued_on date default null,p_area_permit_expires_on date default null,p_remind_days integer default 30,p_note text default '',p_is_active boolean default true
) returns public.migrant_worker_documents language plpgsql security definer set search_path=public as $$
declare v_old public.migrant_worker_documents; v_document public.migrant_worker_documents; v_action text; v_number text;
begin
  perform public.assert_migrant_document_manager();
  if p_worker_id is null or not exists(select 1 from public.foreign_workers where id=p_worker_id) then raise exception 'worker not found'; end if;
  if p_document_type not in ('PASSPORT_RED','PASSPORT_GREEN','PINK_CARD','TEN_YEAR_CARD','WORK_PERMIT') then raise exception 'invalid document type'; end if;
  v_number:=nullif(trim(p_document_number),'');
  if p_document_type<>'WORK_PERMIT' and v_number is null then raise exception 'document number is required'; end if;
  if p_remind_days not between 0 and 365 then raise exception 'invalid reminder days'; end if;
  if p_document_id is null then
    insert into public.migrant_worker_documents(worker_id,document_type,document_number,issued_on,expires_on,visa_issued_on,visa_expires_on,area_permit_issued_on,area_permit_expires_on,remind_days,note,is_active)
    values(p_worker_id,p_document_type,v_number,p_issued_on,p_expires_on,p_visa_issued_on,p_visa_expires_on,p_area_permit_issued_on,p_area_permit_expires_on,p_remind_days,trim(p_note),coalesce(p_is_active,true)) returning * into v_document;
    v_action:='CREATE';
  else
    select * into v_old from public.migrant_worker_documents where id=p_document_id for update;
    if not found then raise exception 'document not found'; end if;
    update public.migrant_worker_documents set worker_id=p_worker_id,document_type=p_document_type,document_number=v_number,issued_on=p_issued_on,expires_on=p_expires_on,visa_issued_on=p_visa_issued_on,visa_expires_on=p_visa_expires_on,area_permit_issued_on=p_area_permit_issued_on,area_permit_expires_on=p_area_permit_expires_on,remind_days=p_remind_days,note=trim(p_note),is_active=coalesce(p_is_active,true)
    where id=p_document_id returning * into v_document;
    v_action:=case when coalesce(v_document.expires_on,'-infinity'::date)>coalesce(v_old.expires_on,'-infinity'::date) or coalesce(v_document.visa_expires_on,'-infinity'::date)>coalesce(v_old.visa_expires_on,'-infinity'::date) or coalesce(v_document.area_permit_expires_on,'-infinity'::date)>coalesce(v_old.area_permit_expires_on,'-infinity'::date) then 'RENEW' else 'UPDATE' end;
  end if;
  insert into public.migrant_worker_document_history(document_id,action,previous_data,new_data,note,changed_by) values(v_document.id,v_action,case when p_document_id is null then null else to_jsonb(v_old) end,to_jsonb(v_document),nullif(trim(p_note),''),auth.uid());
  insert into public.audit_logs(table_name,record_id,action,old_data,new_data,actor_id,event_type,title,detail) values('migrant_worker_documents',v_document.id::text,case when p_document_id is null then 'INSERT' else 'UPDATE' end,case when p_document_id is null then null else to_jsonb(v_old) end,to_jsonb(v_document),auth.uid(),case when v_action='RENEW' then 'MIGRANT_DOCUMENT_RENEW' else 'MIGRANT_DOCUMENT_'||v_action end,coalesce(v_document.document_number,'ใบอนุญาตทำงาน'),case when v_action='RENEW' then 'ต่ออายุเอกสารแรงงานต่างด้าว' else 'บันทึกเอกสารแรงงานต่างด้าว' end);
  return v_document;
end $$;

revoke all on function public.save_migrant_worker_document_details(uuid,uuid,text,text,date,date,date,date,date,date,integer,text,boolean) from public;
grant execute on function public.save_migrant_worker_document_details(uuid,uuid,text,text,date,date,date,date,date,date,integer,text,boolean) to authenticated;
commit;
