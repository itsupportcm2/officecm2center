-- Lock each issuer's request department to the department stored in profiles.
begin;

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
     or v_profile_department not in ('EC','HR','AP','AC','PC','IT','DC','LAB','R&D','QC','RM','PR','PA','ST','MC','SE','O&E','SERVICE') then
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
