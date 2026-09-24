# Design QA

- ตรวจหน้า Dashboard ที่ 1440 × 1024 CSS pixels
- ตรวจหน้า Dashboard, เบิกสินค้าออก และรายงานที่ 390 × 844 CSS pixels ด้วย mobile emulation
- ตรวจสถานะ signed-in ในโหมดข้อมูลจำลองภายในเครื่อง
- ตรวจ build ด้วย TypeScript และ Vite สำเร็จ
- ทดสอบวงจรรับเข้า 5 รีม และเบิกออก 2 รีม โดยยอดกระดาษ A4 เปลี่ยนจาก 86 → 91 → 89 ถูกต้อง
- ตรวจว่ารายการ QA-IN-001 และ QA-OUT-001 ปรากฏในประวัติ และ QA-OUT-001 ปรากฏในรายงานพร้อมแผนก ผู้รับ และผู้อนุมัติ
- ทดสอบเพิ่มรายการต่ออายุที่ใกล้ครบกำหนด ตรวจ pop-up และต่ออายุจาก 25 ก.ย. 2569 เป็น 25 ก.ย. 2570 พร้อมประวัติ
- ทดสอบดาวน์โหลดไฟล์สำรอง ล้างข้อมูลจำลอง และกู้คืนกลับมาได้ครบทั้งรายการต่ออายุ ประวัติ และ Audit Log
- ทดสอบบัญชีจำลอง Admin, Staff และ Viewer พร้อม Route Guard และการซ่อนเมนู/ปุ่มตามสิทธิ์
- ทดสอบเจ้าหน้าที่สร้างใบขอซื้อ แก้จำนวนและหมายเหตุ แล้วส่งอนุมัติ; ผู้ดูแลระบบเปลี่ยนเป็นสั่งซื้อแล้ว พร้อม Audit Log 3 รายการ

## ผลการตรวจ

- ลำดับชั้นข้อมูลบน Dashboard ชัดเจน ปุ่มรับเข้า/เบิกออกกระชับ และรายการเร่งด่วนเชื่อมไปสร้างใบขอซื้อ
- สถานะสต็อกไม่รวมจำนวนสินค้าต่างหน่วยเข้าด้วยกัน
- หน้าเบิกสินค้ามีเลขเอกสาร ผู้รับสินค้า แผนก และผู้อนุมัติครบถ้วน
- หน้ารายงานมีตัวกรองช่วงเวลาแบบสำเร็จรูป ตัวกรองแผนก/ผู้รับ และรายละเอียดเลขเอกสารกับผู้อนุมัติ
- ตารางประวัติแสดงเลขที่เอกสารแล้ว หลังพบจุดตกหล่นระหว่างทดสอบ end-to-end
- หน้า mobile ไม่มี horizontal page overflow; ตารางกว้างเลื่อนภายในพื้นที่ตาราง
- ฟอนต์ สี ระยะห่าง และขนาดพื้นที่กดอ่านง่ายและสม่ำเสมอ

## หลักฐาน

- `work/audit-final/dashboard-desktop.png`
- `work/audit-final/dashboard-mobile-cdp.png`
- `work/audit-final/stock-out-mobile-cdp.png`
- `work/audit-final/reports-mobile-cdp.png`
- `work/audit-final/e2e-history.png`
- `work/audit-final/e2e-report.png`
- `work/audit-final/e2e-result.json`
- `work/audit-final/e2e-renewal-popup.png`
- `work/audit-final/e2e-renewal-history.png`
- `work/audit-final/e2e-backup-restore.png`
- `work/audit-final/renewal-backup-result.json`
- `work/audit-final/e2e-purchase-staff.png`
- `work/audit-final/e2e-purchase-admin.png`
- `work/audit-final/e2e-role-viewer-dashboard.png`
- `work/audit-final/e2e-role-viewer-inventory.png`
- `work/audit-final/roles-purchase-result.json`

## หมายเหตุ

- Vite แจ้งเตือน bundle หลักมีขนาดเกิน 500 kB แต่ไม่กระทบการทำงานในขั้นทดสอบภายในเครื่อง
- โครงการยังไม่มี automated test script จึงตรวจด้วย build และ visual QA

final result: passed
