# ระบบจัดการสำนักงาน เชียงใหม่โฟรเซ่นฟูดส์

เว็บแอปภาษาไทยสำหรับจัดการวัสดุสำนักงาน อุปกรณ์ไอที และรายการต่ออายุ สร้างด้วย React, Vite, TypeScript, Tailwind CSS และ Supabase หากยังไม่กำหนด Supabase ระบบจะทำงานในโหมดทดสอบบนเครื่องและเก็บข้อมูลไว้ใน `localStorage`

## เริ่มใช้งาน

```bash
npm install
npm run dev
```

เปิด URL ที่ Vite แสดงในเทอร์มินัล ระบบเริ่มต้นในโหมดทดลองและสามารถกดเข้าสู่ระบบได้ทันที

## ตั้งค่า Supabase

1. สร้างโปรเจกต์ Supabase
2. คัดลอก `.env.example` เป็น `.env.local`
3. กำหนด `VITE_SUPABASE_URL` และ `VITE_SUPABASE_ANON_KEY`
4. เปิด SQL Editor แล้วรัน migration ตามลำดับ:
   - `supabase/migrations/202609220001_initial_schema.sql`
   - `supabase/migrations/202609230001_hardening.sql`
   - `supabase/migrations/202609240001_online_readiness.sql`
   - `supabase/migrations/202609240002_online_contexts.sql`
   - `supabase/migrations/202609240003_fix_audit_trigger.sql`
   - `supabase/migrations/202609250001_user_management.sql`
   - `supabase/migrations/202609250002_staff_create_items.sql`
   - `supabase/migrations/202609250003_staff_manage_items.sql`
5. Deploy Edge Function `supabase/functions/manage-users` สำหรับหน้าจัดการผู้ใช้
6. รัน `supabase/seed.sql` เพื่อเพิ่มข้อมูลตัวอย่าง
7. สร้างผู้ใช้ Admin คนแรกใน Supabase Authentication และกำหนด role เป็น `admin` ในตาราง `profiles`

Edge Function ใช้ `SUPABASE_SERVICE_ROLE_KEY` ที่ Supabase จัดเตรียมไว้ฝั่งเซิร์ฟเวอร์ ห้ามคัดลอกคีย์นี้มาใส่ `.env.local` หรือโค้ด frontend

สคีมามี RLS, ดัชนี, foreign keys, constraints และฟังก์ชัน `stock_in` / `stock_out` ที่ล็อกแถวและบันทึกธุรกรรมก่อนอัปเดตยอด จึงป้องกันยอดติดลบและความไม่สอดคล้องของข้อมูล

## สิทธิ์ผู้ใช้

- `admin`: จัดการสินค้า ผู้ใช้ หมวดหมู่ ตำแหน่ง และสต็อกทั้งหมด
- `staff`: จัดการสินค้า รับเข้า เบิกออก และดูประวัติ
- `viewer`: อ่านข้อมูลเท่านั้น

## สร้างเวอร์ชันใช้งานจริง

```bash
npm run build
npm run preview
```

ไฟล์สำหรับเผยแพร่จะอยู่ใน `dist/`

## ทดสอบภายในเครื่อง

- ข้อมูลโหมดทดสอบเก็บใน `localStorage` ของเบราว์เซอร์
- เมนู **บันทึกกิจกรรม** ใช้ตรวจการเพิ่ม แก้ไข ลบ รับเข้า เบิกออก และต่ออายุ
- เมนู **สำรองข้อมูล** ใช้ดาวน์โหลดหรือกู้คืนข้อมูลทั้งหมดเป็นไฟล์ JSON
- ระบบแยกยอดสินค้าตามตำแหน่ง รองรับรับเข้า เบิกออก ปรับยอด และโอนย้ายโดยยอดรวมไม่เปลี่ยน
- รองรับนำเข้าสินค้าจาก CSV, ค้นหาด้วยเครื่องอ่านบาร์โค้ด USB และสร้างใบขอซื้อจากสินค้าใกล้หมด
- ดูขั้นตอนทดสอบทั้งหมดได้ที่ `LOCAL_TEST_CHECKLIST.md`
