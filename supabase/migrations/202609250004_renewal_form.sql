begin;

create or replace function public.renew_renewal_v2(
  p_renewal_id uuid,
  p_new_expiry_date date,
  p_cost numeric default null,
  p_evidence_url text default null,
  p_note text default null
) returns public.renewals language plpgsql security definer set search_path=public as $$
declare v_item public.renewals;
begin
  if auth.uid() is null or public.current_role() = 'viewer' then raise exception 'permission denied'; end if;
  if p_cost is not null and p_cost < 0 then raise exception 'cost cannot be negative'; end if;
  select * into v_item from public.renewals where id=p_renewal_id for update;
  if not found then raise exception 'renewal not found'; end if;
  if p_new_expiry_date is null or p_new_expiry_date <= v_item.expiry_date then
    raise exception 'new expiry date must be after current expiry date';
  end if;
  insert into public.renewal_history(renewal_id,previous_expiry_date,new_expiry_date,cost,evidence_url,note,renewed_by)
  values(v_item.id,v_item.expiry_date,p_new_expiry_date,p_cost,nullif(trim(p_evidence_url),''),nullif(trim(p_note),''),auth.uid());
  update public.renewals
  set expiry_date=p_new_expiry_date,last_renewed_at=now()
  where id=v_item.id returning * into v_item;
  return v_item;
end $$;

revoke all on function public.renew_renewal_v2(uuid,date,numeric,text,text) from public;
grant execute on function public.renew_renewal_v2(uuid,date,numeric,text,text) to authenticated;

commit;
