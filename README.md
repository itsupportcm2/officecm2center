# Office Stock Management — ระบบจัดการสต็อกสำนักงาน

เว็บแอปภาษาไทยสำหรับจัดการวัสดุสำนักงานและอุปกรณ์ไอที สร้างด้วย React, Vite, TypeScript, Tailwind CSS และ Supabase หากยังไม่กำหนด Supabase ระบบจะใช้ข้อมูลตัวอย่างในหน่วยความจำทันที

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
4. เปิด SQL Editor แล้วรัน `supabase/migrations/202609220001_initial_schema.sql`
5. รัน `supabase/seed.sql` เพื่อเพิ่มข้อมูลตัวอย่าง
6. สร้างผู้ใช้ใน Supabase Authentication และเพิ่มข้อมูลผู้ใช้ในตาราง `profiles`

สคีมามี RLS, ดัชนี, foreign keys, constraints และฟังก์ชัน `stock_in` / `stock_out` ที่ล็อกแถวและบันทึกธุรกรรมก่อนอัปเดตยอด จึงป้องกันยอดติดลบและความไม่สอดคล้องของข้อมูล

## สิทธิ์ผู้ใช้

- `admin`: จัดการสินค้า ผู้ใช้ หมวดหมู่ ตำแหน่ง และสต็อกทั้งหมด
- `staff`: ดูคลัง รับเข้า เบิกออก และดูประวัติ
- `viewer`: อ่านข้อมูลเท่านั้น

## สร้างเวอร์ชันใช้งานจริง

```bash
npm run build
npm run preview
```

ไฟล์สำหรับเผยแพร่จะอยู่ใน `dist/`
