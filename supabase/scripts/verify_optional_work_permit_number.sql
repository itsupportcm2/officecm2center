-- Read-only verification after 202610130003_optional_work_permit_number.sql.
with checks as (
  select 'work permit may omit document number' check_name,coalesce((
    select position('p_document_type<>''WORK_PERMIT'' and v_number is null' in pg_get_functiondef(p.oid))>0
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='save_migrant_worker_document_details'
  ),false) passed
  union all select 'document number type guard exists',exists(select 1 from pg_constraint where conname='migrant_worker_documents_document_number_by_type')
  union all select 'detail document RPC still executable',has_function_privilege('authenticated','public.save_migrant_worker_document_details(uuid,uuid,text,text,date,date,date,date,date,date,integer,text,boolean)','EXECUTE')
)
select check_name,passed from checks order by check_name;
