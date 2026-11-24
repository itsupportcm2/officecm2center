-- Make area permit dates optional for TEN_YEAR_CARD documents.
-- Drops PostgreSQL auto-named check constraints (e.g. migrant_worker_documents_check2 / migrant_worker_documents_check).
begin;

do $$
declare
  r record;
begin
  for r in
    select conname
    from pg_constraint
    where conrelid = 'public.migrant_worker_documents'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%TEN_YEAR_CARD%'
      and pg_get_constraintdef(oid) ilike '%area_permit_issued_on%'
  loop
    execute format('alter table public.migrant_worker_documents drop constraint if exists %I', r.conname);
  end loop;
end $$;

alter table public.migrant_worker_documents
  drop constraint if exists migrant_worker_documents_check;

alter table public.migrant_worker_documents
  drop constraint if exists migrant_worker_documents_date_order_check;

alter table public.migrant_worker_documents
  add constraint migrant_worker_documents_date_order_check
  check (expires_on is null or issued_on is null or expires_on >= issued_on);

alter table public.migrant_worker_documents
  drop constraint if exists migrant_worker_documents_type_dates_check;

alter table public.migrant_worker_documents
  add constraint migrant_worker_documents_type_dates_check
  check (
    (document_type in ('PASSPORT_RED','PASSPORT_GREEN') and issued_on is not null and expires_on is not null and visa_expires_on is not null and area_permit_issued_on is null and area_permit_expires_on is null)
    or (document_type='PINK_CARD' and issued_on is not null and expires_on is not null and visa_expires_on is null and area_permit_issued_on is null and area_permit_expires_on is null)
    or (document_type='TEN_YEAR_CARD' and issued_on is not null and expires_on is not null and visa_expires_on is null)
    or (document_type='WORK_PERMIT')
  );

commit;
