-- Require a handwritten operator signature when an issue request is approved.
-- Rejections continue to require a reason and do not require a signature.
begin;

alter table public.issue_requests
  add column if not exists approval_signature_path text;

create unique index if not exists issue_requests_approval_signature_path_key
  on public.issue_requests(approval_signature_path)
  where approval_signature_path is not null;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('approval-signatures','approval-signatures',false,200000,array['image/png'])
on conflict(id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "approval signatures upload operators" on storage.objects;
create policy "approval signatures upload operators" on storage.objects
for insert to authenticated with check(
  bucket_id='approval-signatures'
  and public.is_current_user_active()
  and public.current_role() in ('admin','staff')
  and (storage.foldername(name))[1]=auth.uid()::text
);

create or replace function public.can_read_approval_signature(p_signature_path text)
returns boolean language sql stable security definer set search_path=public as $$
  select auth.uid() is not null
    and public.is_current_user_active()
    and (
      public.current_role() in ('admin','staff','fulfiller')
      or (
        public.current_role()='issuer'
        and exists(
          select 1 from public.issue_requests r
          where r.requested_by=auth.uid()
            and r.approval_signature_path=p_signature_path
        )
      )
    );
$$;

drop policy if exists "approval signatures read permitted" on storage.objects;
create policy "approval signatures read permitted" on storage.objects
for select to authenticated using(
  bucket_id='approval-signatures'
  and public.can_read_approval_signature(name)
);

create or replace function public.cleanup_approval_signature(p_signature_path text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or not public.is_current_user_active()
     or public.current_role() not in ('admin','staff') then
    raise exception 'permission denied';
  end if;
  if nullif(trim(p_signature_path),'') is null
     or trim(p_signature_path) not like auth.uid()::text||'/%' then
    raise exception 'invalid signature path';
  end if;
  if exists(
    select 1 from public.issue_requests
    where approval_signature_path=trim(p_signature_path)
  ) then
    raise exception 'signature is already attached to a request';
  end if;
  delete from storage.objects
  where bucket_id='approval-signatures' and name=trim(p_signature_path);
end $$;

drop function if exists public.review_issue_request(uuid,text,text);
create function public.review_issue_request(
  p_request_id uuid,
  p_decision text,
  p_rejection_reason text default null,
  p_approval_signature_path text default null
) returns void language plpgsql security definer set search_path=public as $$
declare
  v_request public.issue_requests;
  v_line record;
  v_physical numeric(14,2);
  v_reserved numeric(14,2);
begin
  if auth.uid() is null or not public.is_current_user_active()
     or public.current_role() not in ('admin','staff') then
    raise exception 'permission denied';
  end if;
  if p_decision not in ('APPROVED','REJECTED') then
    raise exception 'invalid decision';
  end if;

  select * into v_request
  from public.issue_requests
  where id=p_request_id
  for update;
  if not found then raise exception 'request not found'; end if;
  if v_request.status<>'PENDING' then
    raise exception 'request is no longer pending';
  end if;

  if p_decision='REJECTED' then
    if nullif(trim(p_rejection_reason),'') is null then
      raise exception 'rejection reason is required';
    end if;
    update public.issue_requests
    set status='REJECTED',reviewed_by=auth.uid(),reviewed_at=now(),
        rejection_reason=trim(p_rejection_reason),approval_signature_path=null
    where id=v_request.id;
    return;
  end if;

  if nullif(trim(p_approval_signature_path),'') is null
     or trim(p_approval_signature_path) not like auth.uid()::text||'/%'
     or right(lower(trim(p_approval_signature_path)),4)<>'.png' then
    raise exception 'valid approval signature is required';
  end if;
  if not exists(
    select 1 from storage.objects
    where bucket_id='approval-signatures'
      and name=trim(p_approval_signature_path)
  ) then
    raise exception 'approval signature file not found';
  end if;

  for v_line in
    select l.*,i.is_active,i.name item_name
    from public.issue_request_lines l
    join public.items i on i.id=l.item_id
    where l.request_id=v_request.id
    order by l.item_id,l.location_id
  loop
    if not v_line.is_active then
      raise exception 'item % is inactive',v_line.item_name;
    end if;
    select quantity into v_physical
    from public.stock_balances
    where item_id=v_line.item_id and location_id=v_line.location_id
    for update;
    if not found then
      raise exception 'stock balance not found for %',v_line.item_name;
    end if;
    select coalesce(sum(l.quantity),0) into v_reserved
    from public.issue_request_lines l
    join public.issue_requests r on r.id=l.request_id
    where r.status='READY_TO_FULFILL'
      and l.item_id=v_line.item_id
      and l.location_id=v_line.location_id;
    if v_line.quantity>v_physical-v_reserved then
      raise exception 'insufficient available stock for %',v_line.item_name;
    end if;
  end loop;

  update public.issue_requests
  set status='READY_TO_FULFILL',reviewed_by=auth.uid(),reviewed_at=now(),
      rejection_reason=null,
      approval_signature_path=trim(p_approval_signature_path)
  where id=v_request.id;
end $$;

create or replace function public.get_issue_requests() returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare v_result jsonb;v_role public.app_role;
begin
  if auth.uid() is null or not public.is_current_user_active() then raise exception 'permission denied'; end if;
  v_role:=public.current_role();
  if v_role not in ('admin','staff','issuer','fulfiller') then raise exception 'permission denied'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',r.id,'request_no',r.request_no,'status',r.status,'recipient_name',r.recipient_name,
    'department',r.department,'note',r.note,'signature_path',r.signature_path,
    'approval_signature_path',r.approval_signature_path,'rejection_reason',r.rejection_reason,
    'requested_by',r.requested_by,'requested_by_name',requester.full_name,
    'reviewed_by',r.reviewed_by,'reviewed_by_name',reviewer.full_name,'reviewed_at',r.reviewed_at,
    'fulfilled_by',r.fulfilled_by,'fulfilled_by_name',fulfiller.full_name,'fulfilled_at',r.fulfilled_at,
    'created_at',r.created_at,'updated_at',r.updated_at,
    'lines',coalesce((select jsonb_agg(jsonb_build_object(
      'id',l.id,'item_id',l.item_id,'location_id',l.location_id,'quantity',l.quantity,'note',l.note,
      'sku',i.sku,'item_name',i.name,'unit',i.unit,'location_name',loc.name,'available_quantity',coalesce(b.quantity,0)
    ) order by i.name) from public.issue_request_lines l
      join public.items i on i.id=l.item_id join public.locations loc on loc.id=l.location_id
      left join public.stock_balances b on b.item_id=l.item_id and b.location_id=l.location_id
      where l.request_id=r.id),'[]'::jsonb)
  ) order by r.created_at desc),'[]'::jsonb) into v_result
  from public.issue_requests r
  left join public.profiles requester on requester.id=r.requested_by
  left join public.profiles reviewer on reviewer.id=r.reviewed_by
  left join public.profiles fulfiller on fulfiller.id=r.fulfilled_by
  where v_role in ('admin','staff')
     or (v_role='issuer' and r.requested_by=auth.uid())
     or (v_role='fulfiller' and (r.status='READY_TO_FULFILL' or (r.status='FULFILLED' and r.fulfilled_by=auth.uid())));
  return v_result;
end $$;

revoke all on function public.review_issue_request(uuid,text,text,text) from public;
revoke all on function public.cleanup_approval_signature(text) from public;
revoke all on function public.can_read_approval_signature(text) from public;
grant execute on function public.review_issue_request(uuid,text,text,text) to authenticated;
grant execute on function public.cleanup_approval_signature(text) to authenticated;
grant execute on function public.can_read_approval_signature(text) to authenticated;

commit;
