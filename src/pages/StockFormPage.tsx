import { ArrowDownToLine, ArrowRight, ArrowUpFromLine, CheckCircle2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Confirm, Toast } from '../components/ui'
import { DEPARTMENTS } from '../constants/departments'
import { EMPLOYEES } from '../constants/employees'
import { useStock } from '../store/StockContext'

export function StockFormPage({mode}:{mode:'IN'|'OUT'}) {
  const {items,locations,getLocationQuantity,applyStock}=useStock()
  const [params]=useSearchParams()
  const [itemId,setItemId]=useState(params.get('item')??items[0]?.id??'')
  const item=items.find(row=>row.id===itemId)
  const [qty,setQty]=useState(1)
  const [locationId,setLocationId]=useState(item?.locationId??locations[0]?.id??'')
  const [totalPurchaseCost,setTotalPurchaseCost]=useState('')
  const [employeeName,setEmployeeName]=useState('')
  const [department,setDepartment]=useState('')
  const [approvedBy,setApprovedBy]=useState('')
  const [note,setNote]=useState('')
  const [confirm,setConfirm]=useState(false)
  const [saving,setSaving]=useState(false)
  const [toast,setToast]=useState('')
  const [error,setError]=useState('')

  useEffect(()=>{if(!itemId&&items[0])setItemId(items[0].id)},[itemId,items])
  useEffect(()=>{if(item)setLocationId(item.locationId)},[item])

  const purchaseCost=Number(totalPurchaseCost)
  const locationQuantity=getLocationQuantity(itemId,locationId)
  const locationAfter=mode==='IN'?locationQuantity+qty:locationQuantity-qty
  const totalAfter=item?(mode==='IN'?item.quantity+qty:item.quantity-qty):0
  const valid=Boolean(
    item&&qty>0&&locationId&&locationAfter>=0&&(
      mode==='IN'
        ? totalPurchaseCost.trim()!==''&&Number.isFinite(purchaseCost)&&purchaseCost>=0
        : employeeName.trim()&&department.trim()&&approvedBy.trim()
    )
  )
  const missing=mode==='IN'
    ? 'กรอกจำนวนและราคารวมที่ซื้อให้ครบ'
    : 'กรอกผู้รับสินค้า แผนก และผู้อนุมัติให้ครบ'

  const save=async()=>{
    if(saving||!valid)return
    setSaving(true)
    try{
      await applyStock(mode,{
        itemId,locationId,quantity:qty,
        totalPurchaseCost:mode==='IN'?purchaseCost:undefined,
        employeeName,department,approvedBy,note,
      })
      setConfirm(false)
      setToast(mode==='IN'?'รับสินค้าเข้าสต็อกเรียบร้อย':'บันทึกการเบิกสินค้าเรียบร้อย')
      setError('')
      setQty(1)
      setTotalPurchaseCost('')
      setEmployeeName('')
      setDepartment('')
      setApprovedBy('')
      setNote('')
      setTimeout(()=>setToast(''),3000)
    }catch(problem){
      setConfirm(false)
      setError(problem instanceof Error?problem.message:'เกิดข้อผิดพลาด')
    }finally{
      setSaving(false)
    }
  }

  return <div className="stock-page">
    <section className="card stock-form">
      <div className="stock-title">
        <div className={mode==='IN'?'green':'red'}>{mode==='IN'?<ArrowDownToLine/>:<ArrowUpFromLine/>}</div>
        <div><h2>{mode==='IN'?'รับสินค้าเข้าสต็อก':'เบิกสินค้าออกจากสต็อก'}</h2><p>{mode==='IN'?'บันทึกสินค้าที่รับเข้าคลัง':'บันทึกการจ่ายวัสดุให้พนักงาน'}</p></div>
      </div>
      <div className="form-stack">
        <label>สินค้า *<select value={itemId} onChange={event=>setItemId(event.target.value)}>{items.filter(row=>row.isActive).map(row=><option value={row.id} key={row.id}>{row.sku} — {row.name}</option>)}</select></label>
        <div className="location-balance-list">{locations.map(location=><span key={location.id} className={location.id===locationId?'active':''}>{location.name}<b>{getLocationQuantity(itemId,location.id)} {item?.unit}</b></span>)}</div>
        <div className="form-grid">
          <label>ตำแหน่งจัดเก็บ *<select value={locationId} onChange={event=>setLocationId(event.target.value)}>{locations.map(location=><option value={location.id} key={location.id}>{location.name}</option>)}</select></label>
          <label>จำนวน *<input type="number" min="0.01" step="0.01" max={mode==='OUT'?locationQuantity:undefined} value={qty} onChange={event=>setQty(Number(event.target.value))}/></label>
          {mode==='IN'?<label>ราคารวมที่ซื้อ (บาท) *<input type="number" min="0" step="0.01" value={totalPurchaseCost} onChange={event=>setTotalPurchaseCost(event.target.value)} placeholder="เช่น 1250.00"/></label>:<>
            <label>ผู้รับสินค้า *<input value={employeeName} onChange={event=>setEmployeeName(event.target.value)} placeholder="กรอกชื่อ–นามสกุลผู้รับ"/></label>
            <label>แผนก *<select value={department} onChange={event=>setDepartment(event.target.value)}><option value="">เลือกแผนก</option>{DEPARTMENTS.map(value=><option value={value} key={value}>{value}</option>)}</select></label>
            <label>ผู้อนุมัติ *<select value={approvedBy} onChange={event=>setApprovedBy(event.target.value)}><option value="">เลือกผู้อนุมัติ</option>{EMPLOYEES.map(value=><option value={value} key={value}>{value}</option>)}</select></label>
          </>}
        </div>
        <label>หมายเหตุ<textarea value={note} onChange={event=>setNote(event.target.value)} placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)"/></label>
        {error&&<p className="form-error">{error}</p>}
        {!valid&&!error&&<p className="form-hint">{missing}</p>}
        <button className={`btn ${mode==='IN'?'primary':'danger'} submit-btn`} disabled={!valid||saving} onClick={()=>setConfirm(true)}>{saving?'กำลังบันทึก...':'ตรวจสอบและยืนยัน'}</button>
      </div>
    </section>

    <aside className="stock-preview">
      <span>สรุปรายการ</span>
      <div className="preview-item"><div className="product-icon">{item?.name.charAt(0)}</div><div><b>{item?.name}</b><small>{item?.sku} · ยอดรวม {item?.quantity??0} {item?.unit}</small></div></div>
      <div className="stock-math"><div><span>ยอดที่ตำแหน่งนี้</span><strong>{locationQuantity} <small>{item?.unit}</small></strong></div><ArrowRight/><div><span>หลังทำรายการ</span><strong className={locationAfter<0?'negative':'positive'}>{locationAfter} <small>{item?.unit}</small></strong></div></div>
      <div className={`change-box ${mode==='IN'?'in':'out'}`}><span>{mode==='IN'?'จำนวนรับเข้า':'จำนวนที่เบิก'}</span><b>{mode==='IN'?'+':'−'}{qty} {item?.unit}</b></div>
      <p className="total-after-note">ยอดรวมทุกตำแหน่งหลังรายการ: <b>{totalAfter} {item?.unit}</b></p>
      {locationAfter<0&&<p className="form-error">จำนวนที่ขอเบิกมากกว่าสต็อกในตำแหน่งนี้</p>}
      <div className="safety-note"><CheckCircle2 size={18}/>ระบบจะบันทึกยอดก่อนและหลังทุกรายการ เพื่อตรวจสอบย้อนหลังได้</div>
    </aside>

    {confirm&&<Confirm title={mode==='IN'?'ยืนยันการรับสินค้า':'ยืนยันการเบิกสินค้า'} detail={`${item?.name} จำนวน ${qty} ${item?.unit} — คงเหลือที่ตำแหน่งหลังรายการ ${locationAfter} ${item?.unit} และยอดรวม ${totalAfter} ${item?.unit}`} onCancel={()=>setConfirm(false)} onConfirm={save}/>}
    {toast&&<Toast message={toast}/>}
  </div>
}
