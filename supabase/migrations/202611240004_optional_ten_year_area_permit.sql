-- Make area permit dates optional for TEN_YEAR_CARD documents.
begin;

alter table public.migrant_worker_documents
  drop constraint if exists migrant_worker_documents_check;

alter table public.migrant_worker_documents
  add constraint migrant_worker_documents_check
  check (
    (document_type in ('PASSPORT_RED','PASSPORT_GREEN') and issued_on is not null and expires_on is not null and visa_expires_on is not null and area_permit_issued_on is null and area_permit_expires_on is null)
    or (document_type='PINK_CARD' and issued_on is not null and expires_on is not null and visa_expires_on is null and area_permit_issued_on is null and area_permit_expires_on is null)
    or (document_type='TEN_YEAR_CARD' and issued_on is not null and expires_on is not null and visa_expires_on is null)
    or (document_type='WORK_PERMIT')
  );

commit;
