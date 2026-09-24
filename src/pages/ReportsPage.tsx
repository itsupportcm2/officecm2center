import { Boxes, Building2, ClipboardList, Download, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { DEPARTMENTS } from '../constants/departments'
import { useStock } from '../store/StockContext'
import { bangkokDateKey } from '../utils/date'

const csvCell=(value:unknown)=>`"${String(value??'').replaceAll('"','""')}"`
const defaultRange=()=>{const end=new Date();const start=new Date();start.setMonth(start.getMonth()-1);return {from:bangkokDateKey(start),to:bangkokDateKey(end)}}
const formatDateTime=(value:string)=>new Intl.DateTimeFormat('th-TH',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value))
type RangePreset='today'|'month'|'quarter'

export function ReportsPage(){
 const {items,transactions}=useStock()
 const defaults=useMemo(defaultRange,[])
 const [dateFrom,setDateFrom]=useState(defaults.from)
 const [dateTo,setDateTo]=useState(defaults.to)
 const [department,setDepartment]=useState('')
 const [employeeQuery,setEmployeeQuery]=useState('')
 const [activePreset,setActivePreset]=useState<RangePreset|null>(null)

 const applyPreset=(preset:RangePreset)=>{
  const end=new Date();const start=new Date(end)
  if(preset==='month')start.setDate(1)
  if(preset==='quarter')start.setMonth(Math.floor(start.getMonth()/3)*3,1)
  setDateFrom(bangkokDateKey(start));setDateTo(bangkokDateKey(end));setActivePreset(preset)
 }

 const issues=useMemo(()=>transactions.filter(transaction=>{
  if(transaction.type!=='OUT')return false
  const date=bangkokDateKey(transaction.createdAt)
  const matchesDate=date>=dateFrom&&date<=dateTo
  const matchesDepartment=!department||transaction.department===department
  const matchesEmployee=!employeeQuery.trim()||(transaction.employeeName??'').toLocaleLowerCase('th-TH').includes(employeeQuery.trim().toLocaleLowerCase('th-TH'))
  return matchesDate&&matchesDepartment&&matchesEmployee
 }),[transactions,dateFrom,dateTo,department,employeeQuery])

 const itemById=useMemo(()=>new Map(items.map(item=>[item.id,item])),[items])
 const uniqueItems=new Set(issues.map(transaction=>transaction.itemId)).size
 const uniqueDepartments=new Set(issues.map(transaction=>transaction.department).filter(Boolean)).size
 const departmentRows=DEPARTMENTS.map(name=>{const rows=issues.filter(transaction=>transaction.department===name);return {name,transactions:rows.length,items:new Set(rows.map(row=>row.itemId)).size}}).filter(row=>row.transactions>0).sort((a,b)=>b.transactions-a.transactions)
 const maxDepartment=Math.max(1,...departmentRows.map(row=>row.transactions))

 const exportReport=()=>{
  const rows=[['เลขที่เอกสาร','วันที่และเวลา','สินค้า','รหัส','จำนวน','หน่วย','แผนก','ผู้รับสินค้า','ผู้อนุมัติ','ผู้บันทึก'],...issues.map(transaction=>{const item=itemById.get(transaction.itemId);return [transaction.referenceNo??'-',formatDateTime(transaction.createdAt),item?.name??'-',item?.sku??'-',transaction.quantity,item?.unit??'-',transaction.department??'-',transaction.employeeName??'-',transaction.approvedBy??'-',transaction.user]})]
  const url=URL.createObjectURL(new Blob(['\ufeff'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}))
  const anchor=document.createElement('a');anchor.href=url;anchor.download=`issue-report-${department||'all'}-${dateFrom}-${dateTo}.csv`;anchor.click();URL.revokeObjectURL(url)
 }

 return <div className="page-stack issue-report-page">
  <section className="report-filter-bar card">
   <div><h2>รายงานการเบิกสินค้า</h2><p>สรุปว่าเบิกอะไร แผนกใดเป็นผู้เบิก และใครเป็นผู้รับสินค้า</p></div>
   <div className="issue-report-filters">
    <div className="report-presets" aria-label="ช่วงเวลาสำเร็จรูป">
     <button className={activePreset==='today'?'active':''} onClick={()=>applyPreset('today')}>วันนี้</button>
     <button className={activePreset==='month'?'active':''} onClick={()=>applyPreset('month')}>เดือนนี้</button>
     <button className={activePreset==='quarter'?'active':''} onClick={()=>applyPreset('quarter')}>ไตรมาสนี้</button>
    </div>
    <label>ตั้งแต่<input type="date" value={dateFrom} max={dateTo} onChange={event=>{setDateFrom(event.target.value);setActivePreset(null)}}/></label>
    <label>ถึง<input type="date" value={dateTo} min={dateFrom} max={bangkokDateKey()} onChange={event=>{setDateTo(event.target.value);setActivePreset(null)}}/></label>
    <label>แผนก<select value={department} onChange={event=>setDepartment(event.target.value)}><option value="">ทุกแผนก</option>{DEPARTMENTS.map(value=><option value={value} key={value}>{value}</option>)}</select></label>
    <label className="employee-filter">ผู้รับสินค้า<span><Search/><input value={employeeQuery} onChange={event=>setEmployeeQuery(event.target.value)} placeholder="ค้นหาชื่อผู้รับ"/></span></label>
    <button className="btn secondary" onClick={exportReport} disabled={!issues.length}><Download size={17}/>ส่งออก CSV</button>
   </div>
  </section>

  <section className="issue-summary-grid">
   <article><span className="issue-summary-icon blue"><ClipboardList/></span><div><small>จำนวนครั้งที่เบิก</small><strong>{issues.length}</strong><span>รายการ</span></div></article>
   <article><span className="issue-summary-icon teal"><Boxes/></span><div><small>สินค้าที่ถูกเบิก</small><strong>{uniqueItems}</strong><span>ชนิดสินค้า</span></div></article>
   <article><span className="issue-summary-icon amber"><Building2/></span><div><small>แผนกที่เบิก</small><strong>{uniqueDepartments}</strong><span>จาก {DEPARTMENTS.length} แผนก</span></div></article>
  </section>

  <section className="issue-report-layout">
   <article className="card department-report"><div className="card-head"><div><h2>สรุปการเบิกแยกตามแผนก</h2><p>{department?`กำลังแสดงเฉพาะแผนก ${department}`:'เรียงตามจำนวนที่เบิกจากมากไปน้อย'}</p></div></div>
    <div className="department-report-list">{departmentRows.length?departmentRows.map(row=><div key={row.name}><span className="department-code">{row.name}</span><div><b>{row.transactions} รายการเบิก</b><small>{row.items} ชนิดสินค้า</small><i><span style={{width:`${row.transactions/maxDepartment*100}%`}}/></i></div></div>):<p className="empty">ไม่พบข้อมูลการเบิกตามตัวกรองที่เลือก</p>}</div>
   </article>

   <article className="card issue-detail-card"><div className="card-head"><div><h2>รายละเอียดการเบิก</h2><p>พบ {issues.length} รายการ ในช่วง {dateFrom} ถึง {dateTo}</p></div></div><div className="table-wrap"><table className="issue-report-table"><thead><tr><th>เลขที่เอกสาร</th><th>วันที่และเวลา</th><th>สินค้า</th><th>จำนวน</th><th>แผนก</th><th>ผู้รับสินค้า</th><th>ผู้อนุมัติ</th><th>ผู้บันทึก</th></tr></thead><tbody>{issues.length?issues.map(transaction=>{const item=itemById.get(transaction.itemId);return <tr key={transaction.id}><td className="mono">{transaction.referenceNo??'-'}</td><td>{formatDateTime(transaction.createdAt)}</td><td><b>{item?.name??'-'}</b><small>{item?.sku??'-'}</small></td><td><strong>{transaction.quantity} {item?.unit}</strong></td><td><span className="department-badge">{transaction.department??'ไม่ระบุ'}</span></td><td>{transaction.employeeName??'ไม่ระบุ'}</td><td>{transaction.approvedBy??'ไม่ระบุ'}</td><td>{transaction.user}</td></tr>}):<tr><td className="empty" colSpan={8}>ไม่พบรายการเบิกตามตัวกรองที่เลือก</td></tr>}</tbody></table></div></article>
  </section>
 </div>
}
