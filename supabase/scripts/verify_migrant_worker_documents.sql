-- Read-only verification after 202610130001_migrant_worker_documents.sql.
-- Every row should return true.
with checks as (
  select 'employee document officer role exists' check_name,exists(select 1 from pg_enum e join pg_type t on t.oid=e.enumtypid where t.typname='app_role' and e.enumlabel='employee_document_officer') passed
  union all select 'foreign workers table exists',to_regclass('public.foreign_workers') is not null
  union all select 'migrant documents table exists',to_regclass('public.migrant_worker_documents') is not null
  union all select 'document history table exists',to_regclass('public.migrant_worker_document_history') is not null
  union all select 'snapshot RPC exists',to_regprocedure('public.get_migrant_worker_snapshot()') is not null
  union all select 'worker save RPC exists',to_regprocedure('public.save_foreign_worker(uuid,text,text,text,text,text,text,boolean)') is not null
  union all select 'document save RPC exists',to_regprocedure('public.save_migrant_worker_document(uuid,uuid,text,text,date,date,date,date,date,integer,text,boolean)') is not null
  union all select 'raw tables are blocked for authenticated',
    not has_table_privilege('authenticated','public.foreign_workers','SELECT')
    and not has_table_privilege('authenticated','public.migrant_worker_documents','SELECT')
    and not has_table_privilege('authenticated','public.migrant_worker_document_history','SELECT')
)
select check_name,passed from checks order by check_name;
