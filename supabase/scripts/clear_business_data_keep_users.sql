-- DESTRUCTIVE, MANUAL-ONLY SCRIPT
-- ล้างข้อมูลการทำงานทั้งหมด แต่เก็บ auth.users, public.profiles และ public.app_settings
-- ตรวจชื่อ Supabase project ให้ถูกต้องก่อนกด Run และห้ามนำไฟล์นี้ไปใส่ใน migrations

begin;

-- ระบุตารางที่ต้องล้างทั้งหมดในคำสั่งเดียวเพื่อรักษา foreign key
-- TRUNCATE ไม่เรียก DELETE trigger จึงใช้สำหรับงานดูแลระบบครั้งนี้เท่านั้น
truncate table
  public.purchase_request_lines,
  public.purchase_requests,
  public.renewal_history,
  public.renewals,
  public.stock_transactions,
  public.stock_balances,
  public.items,
  public.categories,
  public.locations,
  public.audit_logs
restart identity;

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
