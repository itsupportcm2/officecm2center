-- Two-step issue workflow: approve/reserve, then physically fulfill/deduct.
alter type public.app_role add value if not exists 'fulfiller';
commit;
alter type public.issue_request_status add value if not exists 'READY_TO_FULFILL';
alter type public.issue_request_status add value if not exists 'FULFILLED';
commit;

begin;
alter table public.issue_requests
  add column if not exists fulfilled_by uuid references auth.users(id) on delete set null,
  add column if not exists fulfilled_at timestamptz;
create index if not exists issue_requests_status_created_at_idx on public.issue_requests(status,created_at desc);

create or replace function public.enforce_issuer_readonly_table() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if public.current_role() in ('issuer','fulfiller') then raise exception 'role has read-only access to this resource'; end if;
  if tg_op='DELETE' then return old; end if; return new;
end $$;

create or replace function public.get_operator_stock_snapshot() returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare v_result jsonb;
begin
  if auth.uid() is null or not public.is_current_user_active() or public.current_role() not in ('admin','staff','fulfiller') then raise exception 'permission denied'; end if;
  select jsonb_build_object(
    'items',coalesce((select jsonb_agg(to_jsonb(i)||jsonb_build_object('location_id',i.primary_location_id,'quantity',coalesce((select sum(b.quantity) from public.stock_balances b where b.item_id=i.id),0)) order by i.created_at desc) from public.items i),'[]'::jsonb),
    'categories',coalesce((select jsonb_agg(to_jsonb(c) order by c.name) from public.categories c),'[]'::jsonb),
    'locations',coalesce((select jsonb_agg(to_jsonb(l) order by l.name) from public.locations l),'[]'::jsonb),
    'balances',coalesce((select jsonb_agg(to_jsonb(b) order by b.item_id,b.location_id) from public.stock_balances b),'[]'::jsonb),
    'transactions',coalesce((select jsonb_agg(to_jsonb(recent)||jsonb_build_object('created_by_name',coalesce(p.full_name,'ผู้ใช้งาน')) order by recent.created_at desc) from (select * from public.stock_transactions order by created_at desc limit 10) recent left join public.profiles p on p.id=recent.created_by),'[]'::jsonb)
  ) into v_result;return v_result;
end $$;

create or replace function public.get_operator_stock_history(p_item_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare v_result jsonb;
begin
  if auth.uid() is null or not public.is_current_user_active() or public.current_role() not in ('admin','staff','fulfiller') then raise exception 'permission denied'; end if;
  select coalesce(jsonb_agg(to_jsonb(t)||jsonb_build_object('created_by_name',coalesce(p.full_name,'ผู้ใช้งาน')) order by t.created_at desc),'[]'::jsonb)
  into v_result from public.stock_transactions t left join public.profiles p on p.id=t.created_by where p_item_id is null or t.item_id=p_item_id;
  return v_result;
end $$;

create or replace function public.review_issue_request(
  p_request_id uuid,p_decision text,p_rejection_reason text default null
) returns void language plpgsql security definer set search_path=public as $$
declare v_request public.issue_requests;v_line record;v_physical numeric(14,2);v_reserved numeric(14,2);
begin
  if auth.uid() is null or not public.is_current_user_active() or public.current_role() not in ('admin','staff') then raise exception 'permission denied'; end if;
  if p_decision not in ('APPROVED','REJECTED') then raise exception 'invalid decision'; end if;
  select * into v_request from public.issue_requests where id=p_request_id for update;
  if not found then raise exception 'request not found'; end if;
  if v_request.status<>'PENDING' then raise exception 'request is no longer pending'; end if;
  if p_decision='REJECTED' then
    if nullif(trim(p_rejection_reason),'') is null then raise exception 'rejection reason is required'; end if;
    update public.issue_requests set status='REJECTED',reviewed_by=auth.uid(),reviewed_at=now(),rejection_reason=trim(p_rejection_reason) where id=v_request.id;
    return;
  end if;
  for v_line in select l.*,i.is_active,i.name item_name from public.issue_request_lines l join public.items i on i.id=l.item_id where l.request_id=v_request.id order by l.item_id,l.location_id loop
    if not v_line.is_active then raise exception 'item % is inactive',v_line.item_name; end if;
    select quantity into v_physical from public.stock_balances where item_id=v_line.item_id and location_id=v_line.location_id for update;
    if not found then raise exception 'stock balance not found for %',v_line.item_name; end if;
    select coalesce(sum(l.quantity),0) into v_reserved from public.issue_request_lines l join public.issue_requests r on r.id=l.request_id
    where r.status='READY_TO_FULFILL' and l.item_id=v_line.item_id and l.location_id=v_line.location_id;
    if v_line.quantity>v_physical-v_reserved then raise exception 'insufficient available stock for %',v_line.item_name; end if;
  end loop;
  update public.issue_requests set status='READY_TO_FULFILL',reviewed_by=auth.uid(),reviewed_at=now(),rejection_reason=null where id=v_request.id;
end $$;

create or replace function public.fulfill_issue_request(p_request_id uuid) returns void
language plpgsql security definer set search_path=public as $$
declare v_request public.issue_requests;v_line record;v_before numeric(14,2);v_after numeric(14,2);v_cost numeric(14,4);v_reviewer text;v_transaction_note text;
begin
  if auth.uid() is null or not public.is_current_user_active() or public.current_role() not in ('admin','staff','fulfiller') then raise exception 'permission denied'; end if;
  select * into v_request from public.issue_requests where id=p_request_id for update;
  if not found then raise exception 'request not found'; end if;
  if v_request.status<>'READY_TO_FULFILL' then raise exception 'request is not ready to fulfill'; end if;
  select full_name into v_reviewer from public.profiles where id=v_request.reviewed_by;
  for v_line in select l.*,i.average_unit_cost,i.is_active,i.name item_name from public.issue_request_lines l join public.items i on i.id=l.item_id where l.request_id=v_request.id order by l.item_id,l.location_id loop
    if not v_line.is_active then raise exception 'item % is inactive',v_line.item_name; end if;
    select quantity into v_before from public.stock_balances where item_id=v_line.item_id and location_id=v_line.location_id for update;
    if not found then raise exception 'stock balance not found for %',v_line.item_name; end if;
    if v_line.quantity>v_before then raise exception 'insufficient stock for %',v_line.item_name; end if;
    v_after:=v_before-v_line.quantity;v_cost:=coalesce(v_line.average_unit_cost,0);
    v_transaction_note:=concat(v_request.request_no,case when nullif(trim(v_line.note),'') is not null then ' · '||trim(v_line.note) when nullif(trim(v_request.note),'') is not null then ' · '||trim(v_request.note) else '' end);
    insert into public.stock_transactions(item_id,location_id,transaction_type,quantity,quantity_before,quantity_after,employee_name,department,note,approved_by,unit_cost,total_cost,created_by)
    values(v_line.item_id,v_line.location_id,'OUT',v_line.quantity,v_before,v_after,v_request.recipient_name,v_request.department,v_transaction_note,coalesce(v_reviewer,'เจ้าหน้าที่'),v_cost,round(v_line.quantity*v_cost,2),auth.uid());
    update public.stock_balances set quantity=v_after where item_id=v_line.item_id and location_id=v_line.location_id;
  end loop;
  update public.issue_requests set status='FULFILLED',fulfilled_by=auth.uid(),fulfilled_at=now() where id=v_request.id;
end $$;

create or replace function public.cancel_ready_issue_request(p_request_id uuid,p_reason text) returns void
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or not public.is_current_user_active() or public.current_role() not in ('admin','staff') then raise exception 'permission denied'; end if;
  if nullif(trim(p_reason),'') is null then raise exception 'cancellation reason is required'; end if;
  update public.issue_requests set status='CANCELLED',rejection_reason=trim(p_reason),reviewed_by=auth.uid(),reviewed_at=now() where id=p_request_id and status='READY_TO_FULFILL';
  if not found then raise exception 'ready request not found'; end if;
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
    'department',r.department,'note',r.note,'signature_path',r.signature_path,'rejection_reason',r.rejection_reason,
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

drop policy if exists "issue signatures read permitted" on storage.objects;
create policy "issue signatures read permitted" on storage.objects for select to authenticated using(
  bucket_id='issue-signatures' and public.is_current_user_active() and (
    public.current_role() in ('admin','staff','fulfiller') or (public.current_role()='issuer' and (storage.foldername(name))[1]=auth.uid()::text)
  )
);

revoke all on function public.fulfill_issue_request(uuid) from public;
revoke all on function public.cancel_ready_issue_request(uuid,text) from public;
grant execute on function public.fulfill_issue_request(uuid) to authenticated;
grant execute on function public.cancel_ready_issue_request(uuid,text) to authenticated;
commit;
