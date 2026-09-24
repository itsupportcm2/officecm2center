import type { Category, Item, Location, StockTransaction } from '../types'

export const categories: Category[] = [
  { id: 'cat-stationery', name: 'เครื่องเขียน', description: 'กระดาษ ปากกา และอุปกรณ์สำนักงาน' },
  { id: 'cat-it', name: 'อุปกรณ์ไอที', description: 'อุปกรณ์คอมพิวเตอร์และเครือข่าย' },
  { id: 'cat-printer', name: 'อุปกรณ์เครื่องพิมพ์', description: 'หมึกและวัสดุสำหรับเครื่องพิมพ์' },
  { id: 'cat-cleaning', name: 'อุปกรณ์ทำความสะอาด', description: 'ของใช้เพื่อความสะอาดในสำนักงาน' },
]
export const locations: Location[] = [
  { id: 'loc-it', name: 'ห้องเก็บอุปกรณ์ไอที', description: 'ชั้น 2 อาคารสำนักงาน' },
  { id: 'loc-office', name: 'คลังวัสดุสำนักงาน', description: 'ชั้น 1 ใกล้ฝ่ายธุรการ' },
  { id: 'loc-admin', name: 'ห้องธุรการ', description: 'ตู้เก็บวัสดุฝ่ายบริหาร' },
]
export const items: Item[] = [
  { id:'i1', sku:'ST-001', name:'กระดาษ A4 80 แกรม', description:'กระดาษถ่ายเอกสาร 500 แผ่น', categoryId:'cat-stationery', unit:'รีม', minStock:20, barcode:'885000100001', isActive:true, locationId:'loc-office', quantity:86, createdAt:'2026-01-05' },
  { id:'i2', sku:'ST-002', name:'ปากกาลูกลื่นสีน้ำเงิน', description:'หัว 0.5 มม.', categoryId:'cat-stationery', unit:'ด้าม', minStock:30, barcode:'885000100002', isActive:true, locationId:'loc-admin', quantity:24, createdAt:'2026-01-08' },
  { id:'i3', sku:'ST-003', name:'ปากกาลูกลื่นสีดำ', description:'หัว 0.5 มม.', categoryId:'cat-stationery', unit:'ด้าม', minStock:30, barcode:'885000100003', isActive:true, locationId:'loc-admin', quantity:0, createdAt:'2026-01-08' },
  { id:'i4', sku:'PR-001', name:'หมึกพิมพ์ HP สีดำ', description:'ตลับหมึกสำหรับ HP LaserJet', categoryId:'cat-printer', unit:'ตลับ', minStock:5, barcode:'885000200001', isActive:true, locationId:'loc-office', quantity:4, createdAt:'2026-02-10' },
  { id:'i5', sku:'IT-001', name:'เมาส์ไร้สาย', description:'เมาส์ USB แบบไร้สาย', categoryId:'cat-it', unit:'ชิ้น', minStock:8, barcode:'885000300001', isActive:true, locationId:'loc-it', quantity:18, createdAt:'2026-02-14' },
  { id:'i6', sku:'IT-002', name:'คีย์บอร์ด USB', description:'คีย์บอร์ดภาษาไทย-อังกฤษ', categoryId:'cat-it', unit:'ชิ้น', minStock:6, barcode:'885000300002', isActive:true, locationId:'loc-it', quantity:9, createdAt:'2026-02-14' },
  { id:'i7', sku:'IT-003', name:'สาย LAN CAT6', description:'สายแลนยาว 3 เมตร', categoryId:'cat-it', unit:'เส้น', minStock:15, barcode:'885000300003', isActive:true, locationId:'loc-it', quantity:12, createdAt:'2026-03-01' },
  { id:'i8', sku:'IT-004', name:'สาย HDMI', description:'สาย HDMI ยาว 2 เมตร', categoryId:'cat-it', unit:'เส้น', minStock:8, barcode:'885000300004', isActive:true, locationId:'loc-it', quantity:0, createdAt:'2026-03-01' },
  { id:'i9', sku:'IT-005', name:'แฟลชไดรฟ์ USB 32GB', description:'USB 3.0', categoryId:'cat-it', unit:'ชิ้น', minStock:10, barcode:'885000300005', isActive:true, locationId:'loc-it', quantity:27, createdAt:'2026-03-12' },
  { id:'i10', sku:'CL-001', name:'กระดาษทิชชูทำความสะอาด', description:'ชนิดม้วนใหญ่', categoryId:'cat-cleaning', unit:'แพ็ก', minStock:12, barcode:'885000400001', isActive:true, locationId:'loc-office', quantity:31, createdAt:'2026-04-02' },
]
export const transactions: StockTransaction[] = [
  { id:'TX-260922-001', itemId:'i1', locationId:'loc-office', type:'OUT', quantity:4, before:90, after:86, employeeName:'สุภาวดี', department:'AC', purpose:'งานเอกสารประจำเดือน', user:'ณัฐพล', createdAt:'2026-09-22T09:42:00+07:00' },
  { id:'TX-260922-002', itemId:'i5', locationId:'loc-it', type:'IN', quantity:10, before:8, after:18, referenceNo:'PO-2609-18', user:'ณัฐพล', createdAt:'2026-09-22T08:15:00+07:00' },
  { id:'TX-260921-008', itemId:'i4', locationId:'loc-office', type:'OUT', quantity:2, before:6, after:4, employeeName:'วีรพล', department:'EC', user:'กมลชนก', createdAt:'2026-09-21T15:20:00+07:00' },
  { id:'TX-260921-005', itemId:'i7', locationId:'loc-it', type:'ADJUST', quantity:1, before:13, after:12, note:'ตรวจนับสต็อกประจำสัปดาห์', user:'ณัฐพล', createdAt:'2026-09-21T11:05:00+07:00' },
  { id:'TX-260920-012', itemId:'i2', locationId:'loc-admin', type:'OUT', quantity:6, before:30, after:24, employeeName:'รัชนี', department:'HR', user:'กมลชนก', createdAt:'2026-09-20T13:30:00+07:00' },
]
