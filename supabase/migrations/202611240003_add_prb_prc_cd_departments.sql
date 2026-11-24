-- Align Supabase department/owner allowlists with src/constants/departments.ts (adds PRB, PRC, CD).
begin;

-- 1. Update table check constraints
alter table public.foreign_workers drop constraint if exists foreign_workers_department_check;
alter table public.foreign_workers add constraint foreign_workers_department_check check (
  department in ('EC','HR','AP','AC','PC','IT','DC','LAB','R&D','QC','RM','PR','PA','ST','MC','SE','O&E','SERVICE','PRB','PRC','CD')
);

alter table public.profiles drop constraint if exists profiles_department_check;
alter table public.profiles add constraint profiles_department_check check (
  department is null or department in ('EC','HR','AP','AC','PC','IT','DC','LAB','R&D','QC','RM','PR','PA','ST','MC','SE','O&E','SERVICE','PRB','PRC','CD')
);

alter table public.stock_transactions drop constraint if exists stock_transactions_department_check;
alter table public.stock_transactions add constraint stock_transactions_department_check check (
  department is null or department in ('EC','HR','AP','AC','PC','IT','DC','LAB','R&D','QC','RM','PR','PA','ST','MC','SE','O&E','SERVICE','PRB','PRC','CD')
);

alter table public.renewals drop constraint if exists renewals_owner_check;
alter table public.renewals add constraint renewals_owner_check check (
  owner in ('EC','HR','AP','AC','PC','IT','DC','LAB','R&D','QC','RM','PR','PA','ST','MC','SE','O&E','SERVICE','PRB','PRC','CD')
);

alter table public.issue_requests drop constraint if exists issue_requests_department_check;
alter table public.issue_requests add constraint issue_requests_department_check check (
  department in ('EC','HR','AP','AC','PC','IT','DC','LAB','R&D','QC','RM','PR','PA','ST','MC','SE','O&E','SERVICE','PRB','PRC','CD')
);

-- 2. Update save_foreign_worker_details (13-param version)
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
  if p_department not in ('EC','HR','AP','AC','PC','IT','DC','LAB','R&D','QC','RM','PR','PA','ST','MC','SE','O&E','SERVICE','PRB','PRC','CD') then
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

revoke all on function public.save_foreign_worker_details(uuid,text,text,text,text,text,text,text,date,text,text,boolean,text) from public;
grant execute on function public.save_foreign_worker_details(uuid,text,text,text,text,text,text,text,date,text,text,boolean,text) to authenticated;

-- 3. Update legacy save_foreign_worker RPC
create or replace function public.save_foreign_worker(
  p_worker_id uuid default null,p_employee_code text default '',p_full_name text default '',p_nationality text default '',p_department text default '',p_position text default '',p_note text default '',p_is_active boolean default true
) returns public.foreign_workers language plpgsql security definer set search_path=public as $$
declare v_old public.foreign_workers;v_worker public.foreign_workers;
begin
  perform public.assert_migrant_document_manager();
  if nullif(trim(p_employee_code),'') is null or nullif(trim(p_full_name),'') is null then raise exception 'employee code and name are required'; end if;
  if p_department not in ('EC','HR','AP','AC','PC','IT','DC','LAB','R&D','QC','RM','PR','PA','ST','MC','SE','O&E','SERVICE','PRB','PRC','CD') then raise exception 'invalid department'; end if;
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

revoke all on function public.save_foreign_worker(uuid,text,text,text,text,text,text,boolean) from public;
grant execute on function public.save_foreign_worker(uuid,text,text,text,text,text,text,boolean) to authenticated;

-- 4. Update handle_new_user trigger function
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,full_name,employee_code,department,role,is_active)
  values(
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'),''),split_part(new.email,'@',1),'User'),
    nullif(trim(new.raw_user_meta_data->>'employee_code'),''),
    case when new.raw_user_meta_data->>'department' in ('EC','HR','AP','AC','PC','IT','DC','LAB','R&D','QC','RM','PR','PA','ST','MC','SE','O&E','SERVICE','PRB','PRC','CD')
      then new.raw_user_meta_data->>'department' else null end,
    'viewer',
    true
  ) on conflict(id) do nothing;
  return new;
end $$;

-- 5. Update create_issue_request (5-param version)
create or replace function public.create_issue_request(
  p_recipient_name text,
  p_department text,
  p_note text,
  p_lines jsonb,
  p_signature_path text
) returns uuid language plpgsql security definer set search_path=public as $$
declare
  v_request_id uuid;
  v_request_no text;
  v_line jsonb;
  v_quantity numeric;
  v_available numeric;
  v_line_note text;
  v_profile_department text;
begin
  if auth.uid() is null or not public.is_current_user_active() or public.current_role()<>'issuer' then
    raise exception 'permission denied';
  end if;

  select department into v_profile_department
  from public.profiles
  where id=auth.uid() and is_active;

  if v_profile_department is null
     or v_profile_department not in ('EC','HR','AP','AC','PC','IT','DC','LAB','R&D','QC','RM','PR','PA','ST','MC','SE','O&E','SERVICE','PRB','PRC','CD') then
    raise exception 'user department is not configured';
  end if;
  if nullif(trim(p_department),'') is null or trim(p_department)<>v_profile_department then
    raise exception 'request department must match user profile';
  end if;
  if nullif(trim(p_recipient_name),'') is null then raise exception 'recipient is required'; end if;
  if p_lines is null or jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)=0 then
    raise exception 'at least one item is required';
  end if;
  if nullif(trim(p_signature_path),'') is null
     or trim(p_signature_path) not like auth.uid()::text||'/%'
     or right(lower(trim(p_signature_path)),4)<>'.png' then
    raise exception 'valid department head signature is required';
  end if;
  if not exists(
    select 1 from storage.objects
    where bucket_id='issue-signatures' and name=trim(p_signature_path)
  ) then raise exception 'signature file not found'; end if;

  v_request_no:='IR-'||to_char(current_timestamp at time zone 'Asia/Bangkok','YYYYMMDD')||'-'||lpad(nextval('public.issue_request_no_seq')::text,5,'0');
  insert into public.issue_requests(request_no,requested_by,recipient_name,department,note,signature_path)
  values(v_request_no,auth.uid(),trim(p_recipient_name),v_profile_department,nullif(trim(p_note),''),trim(p_signature_path))
  returning id into v_request_id;

  for v_line in select value from jsonb_array_elements(p_lines) loop
    begin
      v_quantity:=(v_line->>'quantity')::numeric;
    exception when others then raise exception 'invalid quantity';
    end;
    if v_quantity is null or v_quantity<=0 then raise exception 'quantity must be greater than zero'; end if;
    v_line_note:=nullif(trim(v_line->>'note'),'');
    if char_length(v_line_note)>500 then raise exception 'line note is too long'; end if;
    select b.quantity into v_available
    from public.stock_balances b join public.items i on i.id=b.item_id and i.is_active
    where b.item_id=(v_line->>'item_id')::uuid and b.location_id=(v_line->>'location_id')::uuid;
    if not found then raise exception 'active stock item or location balance not found'; end if;
    if v_quantity>v_available then raise exception 'requested quantity exceeds current stock'; end if;
    insert into public.issue_request_lines(request_id,item_id,location_id,quantity,note)
    values(v_request_id,(v_line->>'item_id')::uuid,(v_line->>'location_id')::uuid,v_quantity,v_line_note);
  end loop;
  return v_request_id;
end $$;

revoke all on function public.create_issue_request(text,text,text,jsonb,text) from public;
grant execute on function public.create_issue_request(text,text,text,jsonb,text) to authenticated;

commit;
