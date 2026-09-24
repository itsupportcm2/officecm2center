import { Download, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Empty, TxBadge } from '../components/ui'
import { useStock } from '../store/StockContext'
import { bangkokDateKey, formatThaiDateTime } from '../utils/date'

const csvCell=(value:unknown)=>`"${String(value??'').replaceAll('"','""')}"`

export function StockHistoryPage(){
 const {transactions,items,categories,locations}=useStock();const [params]=useSearchParams();const itemFilter=params.get('item')??''
 const [type,setType]=useState('')
 const [q,setQ]=useState('')
 const [loc,setLoc]=useState('')
 const [category,setCategory]=useState('')
 const [dateFrom,setDateFrom]=useState('')
 const [dateTo,setDateTo]=useState('')

 const filtered=useMemo(()=>transactions.filter(transaction=>{
  const item=items.find(candidate=>candidate.id===transaction.itemId)
  const searchable=`${item?.name??''} ${item?.sku??''} ${transaction.user} ${transaction.employeeName??''} ${transaction.referenceNo??''}`.toLowerCase()
  const transactionDate=bangkokDateKey(transaction.createdAt)
  return (!itemFilter||transaction.itemId===itemFilter)
   &&(!type||transaction.type===type)
   &&(!loc||transaction.locationId===loc||transaction.destinationLocationId===loc)
   &&(!category||item?.categoryId===category)
   &&(!dateFrom||transactionDate>=dateFrom)
   &&(!dateTo||transactionDate<=dateTo)
   &&(!q||searchable.includes(q.trim().toLowerCase()))
 }),[transactions,items,type,q,loc,category,dateFrom,dateTo,itemFilter])

 const exportCsv=()=>{
  const header=['รหัส','วันที่','สินค้า','SKU','ประเภท','จำนวน','ก่อน','หลัง','ตำแหน่ง','ผู้ดำเนินการ','เลขอ้างอิง','หมายเหตุ']
  const rows=filtered.map(transaction=>{
   const item=items.find(candidate=>candidate.id===transaction.itemId)
   const source=locations.find(candidate=>candidate.id===transaction.locationId)?.name
   const destination=locations.find(candidate=>candidate.id===transaction.destinationLocationId)?.name
   return [transaction.id,formatThaiDateTime(transaction.createdAt),item?.name,item?.sku,transaction.type,transaction.quantity,transaction.before,transaction.after,transaction.type==='TRANSFER'?`${source} → ${destination}`:source,transaction.employeeName??transaction.user,transaction.referenceNo,transaction.note]
  })
  const body=[header,...rows].map(row=>row.map(csvCell).join(',')).join('\r\n')
  const url=URL.createObjectURL(new Blob(['\ufeff'+body],{type:'text/csv;charset=utf-8'}))
  const link=document.createElement('a')
  link.href=url
  link.download=`stock-history-${bangkokDateKey()}.csv`
  link.click()
  URL.revokeObjectURL(url)
 }

 return <div className="page-stack">
  <div className="page-actions">
   <div className="search"><Search size={18}/><input aria-label="ค้นหาประวัติสต็อก" placeholder="ค้นหาสินค้า รหัส ผู้ดำเนินการ หรือเลขอ้างอิง" value={q} onChange={event=>setQ(event.target.value)}/></div>
   <button className="btn secondary" onClick={exportCsv} disabled={!filtered.length}><Download size={18}/>ส่งออก CSV</button>
  </div>
  <section className="filters history-filters">
   <input type="date" aria-label="วันที่เริ่มต้น" value={dateFrom} max={dateTo||undefined} onChange={event=>setDateFrom(event.target.value)}/>
   <input type="date" aria-label="วันที่สิ้นสุด" value={dateTo} min={dateFrom||undefined} onChange={event=>setDateTo(event.target.value)}/>
   <select aria-label="ประเภทรายการ" value={type} onChange={event=>setType(event.target.value)}><option value="">ทุกประเภทรายการ</option><option value="IN">รับเข้า</option><option value="OUT">เบิกออก</option><option value="ADJUST">ปรับยอด</option><option value="TRANSFER">โอนย้าย</option></select>
   <select aria-label="หมวดหมู่" value={category} onChange={event=>setCategory(event.target.value)}><option value="">ทุกหมวดหมู่</option>{categories.map(item=><option value={item.id} key={item.id}>{item.name}</option>)}</select>
   <select aria-label="ตำแหน่งจัดเก็บ" value={loc} onChange={event=>setLoc(event.target.value)}><option value="">ทุกตำแหน่ง</option>{locations.map(item=><option value={item.id} key={item.id}>{item.name}</option>)}</select>
  </section>
  <section className="card">
   <div className="table-wrap"><table><thead><tr><th>วันที่</th><th>รหัสรายการ</th><th>เลขที่เอกสาร</th><th>สินค้า</th><th>SKU</th><th>ประเภท</th><th>จำนวน</th><th>ก่อน</th><th>หลัง</th><th>ตำแหน่ง</th><th>พนักงาน/ผู้ใช้</th><th>หมายเหตุ</th></tr></thead><tbody>{filtered.map(transaction=>{const item=items.find(candidate=>candidate.id===transaction.itemId);const source=locations.find(candidate=>candidate.id===transaction.locationId)?.name;const destination=locations.find(candidate=>candidate.id===transaction.destinationLocationId)?.name;return <tr key={transaction.id}><td>{formatThaiDateTime(transaction.createdAt)}</td><td className="mono">{transaction.id}</td><td className="mono">{transaction.referenceNo??'—'}</td><td><b>{item?.name}</b></td><td className="mono">{item?.sku}</td><td><TxBadge type={transaction.type}/></td><td>{transaction.quantity}</td><td>{transaction.before}</td><td><b>{transaction.after}</b></td><td>{transaction.type==='TRANSFER'?`${source} → ${destination}`:source}</td><td>{transaction.employeeName??transaction.user}</td><td>{transaction.note??'—'}</td></tr>})}</tbody></table>{!filtered.length&&<Empty/>}</div>
  </section>
 </div>
}
