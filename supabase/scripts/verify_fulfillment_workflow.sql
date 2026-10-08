-- Read-only verification after 202610080001_fulfillment_workflow.sql.
with checks as (
  select 'fulfiller role exists' check_name,exists(select 1 from pg_enum e join pg_type t on t.oid=e.enumtypid where t.typname='app_role' and e.enumlabel='fulfiller') passed
  union all select 'ready and fulfilled statuses exist',(select count(*)=2 from pg_enum e join pg_type t on t.oid=e.enumtypid where t.typname='issue_request_status' and e.enumlabel in ('READY_TO_FULFILL','FULFILLED'))
  union all select 'fulfillment audit columns exist',(select count(*)=2 from information_schema.columns where table_schema='public' and table_name='issue_requests' and column_name in ('fulfilled_by','fulfilled_at'))
  union all select 'fulfill RPC exists',to_regprocedure('public.fulfill_issue_request(uuid)') is not null
  union all select 'cancel ready RPC exists',to_regprocedure('public.cancel_ready_issue_request(uuid,text)') is not null
  union all select 'approval moves to ready',coalesce((select position('READY_TO_FULFILL' in pg_get_functiondef(p.oid))>0 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='review_issue_request'),false)
  union all select 'fulfillment deducts stock',coalesce((select position('update public.stock_balances' in lower(pg_get_functiondef(p.oid)))>0 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='fulfill_issue_request'),false)
  union all select 'authenticated can execute fulfill RPC',has_function_privilege('authenticated','public.fulfill_issue_request(uuid)','EXECUTE')
)
select check_name,passed from checks order by check_name;
