import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Archive, ArrowDownToLine, ArrowUpFromLine, BarChart3, Bell, Boxes, ChevronDown, ClipboardList, LayoutDashboard, LogOut, MapPin, Menu, PackageMinus, Settings, ShieldCheck, Tags, Users, X } from 'lucide-react'

const nav=[
  ['/',LayoutDashboard,'ภาพรวม'],['/inventory',Boxes,'คลังสินค้า'],['/stock-in',ArrowDownToLine,'รับสินค้าเข้า'],['/stock-out',ArrowUpFromLine,'เบิกสินค้าออก'],
  ['/history',ClipboardList,'ประวัติสต็อก'],['/low-stock',PackageMinus,'สินค้าใกล้หมด'],['/categories',Tags,'หมวดหมู่'],['/locations',MapPin,'ตำแหน่งจัดเก็บ'],
  ['/reports',BarChart3,'รายงาน'],['/users',Users,'ผู้ใช้งาน'],['/settings',Settings,'ตั้งค่า'],
] as const
const titles:Record<string,string>={'/':'ภาพรวม','/inventory':'คลังสินค้า','/stock-in':'รับสินค้าเข้า','/stock-out':'เบิกสินค้าออก','/history':'ประวัติสต็อก','/low-stock':'สินค้าใกล้หมด','/categories':'หมวดหมู่','/locations':'ตำแหน่งจัดเก็บ','/reports':'รายงาน','/users':'ผู้ใช้งาน','/settings':'ตั้งค่า'}
export function AppLayout(){const [open,setOpen]=useState(false);const loc=useLocation();const title=loc.pathname.startsWith('/inventory/')?'รายละเอียดสินค้า':titles[loc.pathname]??'ระบบสต็อก'
 return <div className="app-shell">
  {open&&<button className="mobile-overlay" aria-label="ปิดเมนู" onClick={()=>setOpen(false)}/>}<aside className={`sidebar ${open?'open':''}`}>
   <div className="brand"><div className="brand-mark"><Archive size={20}/></div><div><strong>OFFICE STOCK</strong><span>ระบบคลังสำนักงาน</span></div><button className="icon-btn mobile-only" onClick={()=>setOpen(false)}><X size={20}/></button></div>
   <nav>{nav.map(([to,Icon,label])=><NavLink key={to} to={to} end={to==='/'} onClick={()=>setOpen(false)}><Icon size={19}/><span>{label}</span></NavLink>)}</nav>
   <div className="side-profile"><div className="avatar">ณพ</div><div><strong>ณัฐพล พรหมดี</strong><span>ผู้ดูแลระบบ</span></div><ChevronDown size={16}/></div>
   <NavLink to="/login" className="logout"><LogOut size={18}/>ออกจากระบบ</NavLink>
  </aside>
  <div className="main-area"><header className="topbar"><button className="icon-btn menu-btn" onClick={()=>setOpen(true)}><Menu size={22}/></button><div><h1>{title}</h1><p>{new Intl.DateTimeFormat('th-TH',{dateStyle:'full'}).format(new Date('2026-09-22'))}</p></div><div className="top-actions"><button className="icon-btn notify"><Bell size={20}/><i/></button><div className="top-user"><div className="avatar">ณพ</div><div><strong>ณัฐพล</strong><span>แอดมิน</span></div></div></div></header><main><Outlet/></main></div>
 </div>}
