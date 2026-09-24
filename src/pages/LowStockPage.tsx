import { AlertTriangle, ArrowDownToLine, FilePlus2, PackageX } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Empty, StatusBadge, Toast } from '../components/ui'
import { useAuth } from '../store/AuthContext'
import { usePurchases } from '../store/PurchaseContext'
import { useStock } from '../store/StockContext'
import { useState } from 'react'

export function LowStockPage(){
 const {items,categories,locations}=useStock();const {createFromItems}=usePurchases();const {user}=useAuth();const navigate=useNavigate();const [toast,setToast]=useState('')
 const groups=[{title:'สินค้าหมด',icon:PackageX,items:items.filter(item=>item.quantity===0),tone:'red'},{title:'สินค้าใกล้หมด',icon:AlertTriangle,items:items.filter(item=>item.quantity>0&&item.quantity<=item.minStock),tone:'amber'}]
 const urgent=groups.flatMap(group=>group.items)
 const create=(selected:typeof items)=>{const request=createFromItems(selected);if(!request){setToast('รายการนี้อยู่ในใบขอซื้อที่กำลังดำเนินการแล้ว');setTimeout(()=>setToast(''),2500);return}setToast(`สร้าง ${request.requestNo} แล้ว`);setTimeout(()=>navigate('/purchase-requests'),700)}
 return <div className="page-stack"><div className="notice"><AlertTriangle size={20}/><div><b>พบ {urgent.length} รายการที่ต้องดำเนินการ</b><span>ตรวจสอบ เติมสต็อก หรือสร้างใบขอซื้อเพื่อไม่ให้กระทบการใช้งาน</span></div>{user?.role!=='viewer'&&urgent.length>0&&<button className="btn primary" onClick={()=>create(urgent)}><FilePlus2 size={18}/>สร้างใบขอซื้อทั้งหมด</button>}</div>
  {groups.map(group=><section className="card" key={group.title}><div className="card-head"><div className="section-with-icon"><span className={`metric-icon ${group.tone}`}><group.icon size={20}/></span><div><h2>{group.title}</h2><p>{group.items.length} รายการ</p></div></div></div><div className="table-wrap"><table><thead><tr><th>สินค้า</th><th>รหัส</th><th>หมวดหมู่</th><th>ตำแหน่งหลัก</th><th>คงเหลือ</th><th>ขั้นต่ำ</th><th>สถานะ</th><th>ดำเนินการ</th></tr></thead><tbody>{group.items.map(item=><tr key={item.id}><td><b>{item.name}</b></td><td className="mono">{item.sku}</td><td>{categories.find(category=>category.id===item.categoryId)?.name}</td><td>{locations.find(location=>location.id===item.locationId)?.name}</td><td><b>{item.quantity}</b> {item.unit}</td><td>{item.minStock} {item.unit}</td><td><StatusBadge item={item}/></td><td>{user?.role!=='viewer'?<div className="row-actions"><Link className="btn compact primary" to={`/stock-in?item=${item.id}`}><ArrowDownToLine size={16}/>รับเข้า</Link><button className="btn compact secondary" onClick={()=>create([item])}><FilePlus2 size={16}/>ขอซื้อ</button></div>:<Link className="btn compact secondary" to={`/inventory/${item.id}`}>ดูรายละเอียด</Link>}</td></tr>)}</tbody></table>{!group.items.length&&<Empty text="ไม่มีรายการในกลุ่มนี้"/>}</div></section>)}{toast&&<Toast message={toast}/>}
 </div>
}
