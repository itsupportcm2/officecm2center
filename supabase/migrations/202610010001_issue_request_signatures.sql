-- Handwritten department-head signatures for issue requests.
-- Files are private and can only be read by operators or the issuer who uploaded them.
begin;

alter table public.issue_requests
  add column if not exists signature_path text;
create unique index if not exists issue_requests_signature_path_key
  on public.issue_requests(signature_path) where signature_path is not null;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('issue-signatures','issue-signatures',false,200000,array['image/png'])
on conflict(id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "issue signatures upload own" on storage.objects;
create policy "issue signatures upload own" on storage.objects
for insert to authenticated with check(
  bucket_id='issue-signatures'
  and public.is_current_user_active()
  and public.current_role()='issuer'
  and (storage.foldername(name))[1]=auth.uid()::text
);

drop policy if exists "issue signatures read permitted" on storage.objects;
create policy "issue signatures read permitted" on storage.objects
for select to authenticated using(
  bucket_id='issue-signatures'
  and public.is_current_user_active()
  and (
    public.current_role() in ('admin','staff')
    or (public.current_role()='issuer' and (storage.foldername(name))[1]=auth.uid()::text)
  )
);

drop policy if exists "issue signatures cleanup own" on storage.objects;

create or replace function public.cleanup_issue_signature(p_signature_path text) returns void
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or not public.is_current_user_active() or public.current_role()<>'issuer' then
    raise exception 'permission denied';
  end if;
  if nullif(trim(p_signature_path),'') is null
     or trim(p_signature_path) not like auth.uid()::text||'/%' then
    raise exception 'invalid signature path';
  end if;
  if exists(select 1 from public.issue_requests where signature_path=trim(p_signature_path)) then
    raise exception 'signature is already attached to a request';
  end if;
  delete from storage.objects
  where bucket_id='issue-signatures' and name=trim(p_signature_path);
end $$;

drop function if exists public.create_issue_request(text,text,text,jsonb);
create function public.create_issue_request(
  p_recipient_name text,
  p_department text,
  p_note text,
  p_lines jsonb,
  p_signature_path text
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_request_id uuid;v_request_no text;v_line jsonb;v_quantity numeric;v_available numeric;
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
    select b.quantity into v_available
    from public.stock_balances b join public.items i on i.id=b.item_id and i.is_active
    where b.item_id=(v_line->>'item_id')::uuid and b.location_id=(v_line->>'location_id')::uuid;
    if not found then raise exception 'active stock item or location balance not found'; end if;
    if v_quantity>v_available then raise exception 'requested quantity exceeds current stock'; end if;
    insert into public.issue_request_lines(request_id,item_id,location_id,quantity)
    values(v_request_id,(v_line->>'item_id')::uuid,(v_line->>'location_id')::uuid,v_quantity);
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
      'sku',i.sku,'item_name',i.name,'unit',i.unit,'location_name',loc.name,
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

revoke all on function public.create_issue_request(text,text,text,jsonb,text) from public;
revoke all on function public.cleanup_issue_signature(text) from public;
grant execute on function public.create_issue_request(text,text,text,jsonb,text) to authenticated;
grant execute on function public.cleanup_issue_signature(text) to authenticated;

commit;
