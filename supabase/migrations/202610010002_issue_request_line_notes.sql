-- Optional usage notes for each individual line in an issue request.
begin;

alter table public.issue_request_lines
  add column if not exists note text;

do $$ begin
  alter table public.issue_request_lines
    add constraint issue_request_lines_note_length
    check (note is null or char_length(note) <= 500);
exception when duplicate_object then null;
end $$;

create or replace function public.create_issue_request(
  p_recipient_name text,
  p_department text,
  p_note text,
  p_lines jsonb,
  p_signature_path text
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_request_id uuid;v_request_no text;v_line jsonb;v_quantity numeric;v_available numeric;v_line_note text;
begin
  if auth.uid() is null or not public.is_current_user_active() or public.current_role()<>'issuer' then
    raise exception 'permission denied';
  end if;
  if nullif(trim(p_recipient_name),'') is null then raise exception 'recipient is required'; end if;
  if p_department not in ('EC','HR','AP','AC','PC','IT','DC','LAB','R&D','QC','RM','PR','PA','ST','MC','SE','O&E','SERVICE') then
    raise exception 'invalid department';
  end if;
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
  values(v_request_no,auth.uid(),trim(p_recipient_name),p_department,nullif(trim(p_note),''),trim(p_signature_path))
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

create or replace function public.get_issue_requests() returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare v_result jsonb;v_role public.app_role;
begin
  if auth.uid() is null or not public.is_current_user_active() then raise exception 'permission denied'; end if;
  v_role:=public.current_role();
  if v_role not in ('admin','staff','issuer') then raise exception 'permission denied'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',r.id,'request_no',r.request_no,'status',r.status,'recipient_name',r.recipient_name,
    'department',r.department,'note',r.note,'signature_path',r.signature_path,
    'rejection_reason',r.rejection_reason,
    'requested_by',r.requested_by,'requested_by_name',requester.full_name,
    'reviewed_by',r.reviewed_by,'reviewed_by_name',reviewer.full_name,
    'reviewed_at',r.reviewed_at,'created_at',r.created_at,'updated_at',r.updated_at,
    'lines',coalesce((select jsonb_agg(jsonb_build_object(
      'id',l.id,'item_id',l.item_id,'location_id',l.location_id,'quantity',l.quantity,
      'note',l.note,'sku',i.sku,'item_name',i.name,'unit',i.unit,'location_name',loc.name,
      'available_quantity',coalesce(b.quantity,0)
    ) order by i.name) from public.issue_request_lines l
      join public.items i on i.id=l.item_id join public.locations loc on loc.id=l.location_id
      left join public.stock_balances b on b.item_id=l.item_id and b.location_id=l.location_id
      where l.request_id=r.id),'[]'::jsonb)
  ) order by r.created_at desc),'[]'::jsonb) into v_result
  from public.issue_requests r
  left join public.profiles requester on requester.id=r.requested_by
  left join public.profiles reviewer on reviewer.id=r.reviewed_by
  where v_role in ('admin','staff') or r.requested_by=auth.uid();
  return v_result;
end $$;

create or replace function public.review_issue_request(
  p_request_id uuid,p_decision text,p_rejection_reason text default null
) returns void language plpgsql security definer set search_path=public as $$
declare v_request public.issue_requests;v_line record;v_before numeric(14,2);v_after numeric(14,2);v_cost numeric(14,4);v_reviewer text;v_transaction_note text;
begin
  if auth.uid() is null or not public.is_current_user_active() or public.current_role() not in ('admin','staff') then
    raise exception 'permission denied';
  end if;
  if p_decision not in ('APPROVED','REJECTED') then raise exception 'invalid decision'; end if;
  select * into v_request from public.issue_requests where id=p_request_id for update;
  if not found then raise exception 'request not found'; end if;
  if v_request.status<>'PENDING' then raise exception 'request is no longer pending'; end if;
  if p_decision='REJECTED' then
    if nullif(trim(p_rejection_reason),'') is null then raise exception 'rejection reason is required'; end if;
    update public.issue_requests set status='REJECTED',reviewed_by=auth.uid(),reviewed_at=now(),rejection_reason=trim(p_rejection_reason)
    where id=v_request.id;
    return;
  end if;

  select full_name into v_reviewer from public.profiles where id=auth.uid();
  for v_line in
    select l.*,i.average_unit_cost,i.is_active,i.name item_name
    from public.issue_request_lines l join public.items i on i.id=l.item_id
    where l.request_id=v_request.id order by l.item_id,l.location_id
  loop
    if not v_line.is_active then raise exception 'item % is inactive',v_line.item_name; end if;
    select quantity into v_before from public.stock_balances
    where item_id=v_line.item_id and location_id=v_line.location_id for update;
    if not found then raise exception 'stock balance not found for %',v_line.item_name; end if;
    if v_line.quantity>v_before then raise exception 'insufficient stock for %',v_line.item_name; end if;
    v_after:=v_before-v_line.quantity;v_cost:=coalesce(v_line.average_unit_cost,0);
    v_transaction_note:=concat(
      v_request.request_no,
      case
        when nullif(trim(v_line.note),'') is not null then ' · '||trim(v_line.note)
        when nullif(trim(v_request.note),'') is not null then ' · '||trim(v_request.note)
        else ''
      end
    );
    insert into public.stock_transactions(
      item_id,location_id,transaction_type,quantity,quantity_before,quantity_after,
      employee_name,department,note,approved_by,unit_cost,total_cost,created_by
    ) values(
      v_line.item_id,v_line.location_id,'OUT',v_line.quantity,v_before,v_after,
      v_request.recipient_name,v_request.department,v_transaction_note,
      coalesce(v_reviewer,'เจ้าหน้าที่'),v_cost,round(v_line.quantity*v_cost,2),auth.uid()
    );
    update public.stock_balances set quantity=v_after
    where item_id=v_line.item_id and location_id=v_line.location_id;
  end loop;
  update public.issue_requests set status='APPROVED',reviewed_by=auth.uid(),reviewed_at=now(),rejection_reason=null
  where id=v_request.id;
end $$;

revoke all on function public.create_issue_request(text,text,text,jsonb,text) from public;
revoke all on function public.get_issue_requests() from public;
revoke all on function public.review_issue_request(uuid,text,text) from public;
grant execute on function public.create_issue_request(text,text,text,jsonb,text) to authenticated;
grant execute on function public.get_issue_requests() to authenticated;
grant execute on function public.review_issue_request(uuid,text,text) to authenticated;

commit;
