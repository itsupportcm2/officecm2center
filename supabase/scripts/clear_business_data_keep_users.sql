-- DESTRUCTIVE, MANUAL-ONLY SCRIPT
-- ล้างข้อมูลการทำงานทั้งหมด แต่เก็บ auth.users, public.profiles และ public.app_settings
-- ตรวจชื่อ Supabase project ให้ถูกต้องก่อนกด Run และห้ามนำไฟล์นี้ไปใส่ใน migrations

begin;

-- ลบตารางลูกก่อน เพื่อไม่ให้ชน foreign key
delete from public.purchase_request_lines;
delete from public.purchase_requests;
delete from public.renewal_history;
delete from public.renewals;
delete from public.stock_transactions;
delete from public.stock_balances;
delete from public.items;
delete from public.categories;
delete from public.locations;

-- ลบเป็นลำดับสุดท้าย เพราะ trigger ด้านบนอาจสร้าง audit ระหว่างการล้างข้อมูล
delete from public.audit_logs;

commit;

-- ผลที่ถูกต้อง: profiles ต้องมากกว่า 0 และตารางอื่นทั้งหมดต้องเป็น 0
select 'profiles (kept)' as table_name, count(*) as row_count from public.profiles
union all select 'categories', count(*) from public.categories
union all select 'locations', count(*) from public.locations
union all select 'items', count(*) from public.items
union all select 'stock_balances', count(*) from public.stock_balances
union all select 'stock_transactions', count(*) from public.stock_transactions
union all select 'purchase_requests', count(*) from public.purchase_requests
union all select 'purchase_request_lines', count(*) from public.purchase_request_lines
union all select 'renewals', count(*) from public.renewals
union all select 'renewal_history', count(*) from public.renewal_history
union all select 'audit_logs', count(*) from public.audit_logs;
