-- Read-only verification after 202610130002_migrant_worker_entry_details.sql.
with checks as (
  select 'worker register detail columns exist' check_name,(
    select count(*)=4 from information_schema.columns where table_schema='public' and table_name='foreign_workers' and column_name in ('organization_unit','title','national_id','birth_date')
  ) passed
  union all select 'visa issue date column exists',exists(select 1 from information_schema.columns where table_schema='public' and table_name='migrant_worker_documents' and column_name='visa_issued_on')
  union all select 'worker details save RPC exists',to_regprocedure('public.save_foreign_worker_details(uuid,text,text,text,text,text,text,text,date,text,text,boolean)') is not null
  union all select 'document details save RPC exists',to_regprocedure('public.save_migrant_worker_document_details(uuid,uuid,text,text,date,date,date,date,date,date,integer,text,boolean)') is not null
  union all select 'authenticated can execute detail RPCs',
    has_function_privilege('authenticated','public.save_foreign_worker_details(uuid,text,text,text,text,text,text,text,date,text,text,boolean)','EXECUTE')
    and has_function_privilege('authenticated','public.save_migrant_worker_document_details(uuid,uuid,text,text,date,date,date,date,date,date,integer,text,boolean)','EXECUTE')
)
select check_name,passed from checks order by check_name;
