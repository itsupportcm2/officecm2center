import { Download, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Empty } from '../components/ui'
import { useAudit, type AuditAction } from '../store/AuditContext'
import { bangkokDateKey, formatThaiDateTime } from '../utils/date'

const labels:Record<AuditAction,string>={CREATE:'เพิ่มข้อมูล',UPDATE:'แก้ไขข้อมูล',DELETE:'ลบข้อมูล',STOCK_IN:'รับสินค้าเข้า',STOCK_OUT:'เบิกสินค้าออก',STOCK_ADJUST:'ปรับยอดสต็อก',STOCK_TRANSFER:'โอนย้ายสต็อก',PURCHASE_CREATE:'สร้างใบขอซื้อ',PURCHASE_UPDATE:'อัปเดตใบขอซื้อ',RENEW:'ต่ออายุ',BACKUP:'สำรองข้อมูล',RESTORE:'กู้คืนข้อมูล',SETTINGS:'เปลี่ยนการตั้งค่า'}
const csvCell=(value:unknown)=>`"${String(value??'').replaceAll('"','""')}"`

export function AuditLogPage(){
 const {entries}=useAudit()
 const [query,setQuery]=useState('')
 const [action,setAction]=useState('')
 const filtered=useMemo(()=>entries.filter(entry=>(!action||entry.action===action)&&(!query||`${entry.title} ${entry.detail} ${entry.actor}`.toLowerCase().includes(query.trim().toLowerCase()))),[entries,query,action])
 const exportCsv=()=>{
  const rows=[['วันที่','กิจกรรม','รายการ','รายละเอียด','ผู้ดำเนินการ'],...filtered.map(entry=>[formatThaiDateTime(entry.createdAt),labels[entry.action],entry.title,entry.detail,entry.actor])]
  const url=URL.createObjectURL(new Blob(['\ufeff'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}))
  const link=document.createElement('a');link.href=url;link.download=`audit-log-${bangkokDateKey()}.csv`;link.click();URL.revokeObjectURL(url)
 }
 return <div className="page-stack">
  <div className="page-actions"><div><h2 className="renewal-heading">บันทึกกิจกรรมระบบ</h2><p className="page-intro">ตรวจสอบว่าใครดำเนินการอะไรและเมื่อใด ข้อมูลย้อนหลังสูงสุด 1,000 รายการ</p></div><button className="btn secondary" disabled={!filtered.length} onClick={exportCsv}><Download size={18}/>ส่งออก CSV</button></div>
  <section className="filters audit-filters"><div className="search"><Search size={18}/><input aria-label="ค้นหากิจกรรม" placeholder="ค้นหารายการ รายละเอียด หรือผู้ดำเนินการ" value={query} onChange={event=>setQuery(event.target.value)}/></div><select aria-label="ประเภทกิจกรรม" value={action} onChange={event=>setAction(event.target.value)}><option value="">ทุกกิจกรรม</option>{Object.entries(labels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></section>
  <section className="card"><div className="table-wrap"><table><thead><tr><th>วันและเวลา</th><th>กิจกรรม</th><th>รายการ</th><th>รายละเอียด</th><th>ผู้ดำเนินการ</th></tr></thead><tbody>{filtered.map(entry=><tr key={entry.id}><td>{formatThaiDateTime(entry.createdAt)}</td><td><span className={`audit-action audit-${entry.action.toLowerCase()}`}>{labels[entry.action]}</span></td><td><b>{entry.title}</b></td><td>{entry.detail}</td><td>{entry.actor}</td></tr>)}</tbody></table>{!filtered.length&&<Empty text="ยังไม่มีบันทึกกิจกรรม"/>}</div></section>
 </div>
}
