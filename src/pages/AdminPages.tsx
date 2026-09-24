import { Edit3, Save, Search, ShieldCheck, UserPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Modal, Toast } from '../components/ui'
import { useAudit } from '../store/AuditContext'
import { DEPARTMENTS } from '../constants/departments'
import type { Role } from '../types'
import { isSupabaseConfigured } from '../lib/supabase'
import { defaultSettings, settingsService, type AppSettings } from '../services/settingsService'

interface AdminUser{id:string;name:string;code:string;department:string;role:Role;active:boolean}
type Settings=AppSettings

const USER_KEY='cm-office-users-v1'
const SETTINGS_KEY='cm-office-settings-v1'
const seedUsers:AdminUser[]=[
 {id:'u1',name:'ณัฐพล พรหมดี',code:'EMP-001',department:'IT',role:'admin',active:true},
 {id:'u2',name:'กมลชนก วิเศษ',code:'EMP-014',department:'ST',role:'staff',active:true},
 {id:'u3',name:'สุภาวดี มีสุข',code:'EMP-027',department:'AC',role:'viewer',active:true},
 {id:'u4',name:'วีรพล ตั้งมั่น',code:'EMP-031',department:'EC',role:'staff',active:true},
]
const defaults:Settings=defaultSettings
const read=<T,>(key:string,fallback:T):T=>{try{const value=localStorage.getItem(key);return value?JSON.parse(value):fallback}catch{return fallback}}
const roleLabel:Record<Role,string>={admin:'ผู้ดูแลระบบ',staff:'เจ้าหน้าที่',viewer:'ผู้ดูข้อมูล'}

export function UsersPage(){
 const {record}=useAudit()
 const [users,setUsers]=useState<AdminUser[]>(()=>read(USER_KEY,seedUsers))
 const [open,setOpen]=useState(false);const [editingId,setEditingId]=useState<string|null>(null);const [query,setQuery]=useState('');const [toast,setToast]=useState('')
 const [form,setForm]=useState({name:'',code:'',department:'',role:'staff' as Role})
 const flash=(message:string)=>{setToast(message);setTimeout(()=>setToast(''),2500)}
 const save=()=>{
  if(!form.name||!form.code||!form.department){flash('กรุณากรอกข้อมูลให้ครบ');return}
  if(users.some(user=>user.id!==editingId&&user.code.toLowerCase()===form.code.trim().toLowerCase())){flash('รหัสพนักงานนี้มีอยู่แล้ว');return}
  if(editingId){const next=users.map(user=>user.id===editingId?{...user,...form,code:form.code.trim()}:user);setUsers(next);localStorage.setItem(USER_KEY,JSON.stringify(next));record({action:'UPDATE',entity:'user',entityId:editingId,title:form.name,detail:`แก้ไขผู้ใช้งาน ${form.code}`});flash('แก้ไขผู้ใช้งานแล้ว')}
  else{const created={...form,code:form.code.trim(),id:crypto.randomUUID(),active:true};const next=[...users,created];setUsers(next);localStorage.setItem(USER_KEY,JSON.stringify(next));record({action:'CREATE',entity:'user',entityId:created.id,title:created.name,detail:`เพิ่มผู้ใช้งาน ${created.code} บทบาท ${roleLabel[created.role]}`});flash('เพิ่มผู้ใช้งานแล้ว')}
  setOpen(false);setEditingId(null);setForm({name:'',code:'',department:'',role:'staff'})
 }
 const openCreate=()=>{setEditingId(null);setForm({name:'',code:'',department:'',role:'staff'});setOpen(true)}
 const openEdit=(user:AdminUser)=>{setEditingId(user.id);setForm({name:user.name,code:user.code,department:user.department,role:user.role});setOpen(true)}
 const toggle=(user:AdminUser)=>{const active=!user.active;const next=users.map(row=>row.id===user.id?{...row,active}:row);setUsers(next);localStorage.setItem(USER_KEY,JSON.stringify(next));record({action:'UPDATE',entity:'user',entityId:user.id,title:user.name,detail:active?'เปิดใช้งานผู้ใช้':'ระงับผู้ใช้งาน'})}
 const shown=users.filter(user=>`${user.name} ${user.code} ${user.department}`.toLocaleLowerCase('th-TH').includes(query.trim().toLocaleLowerCase('th-TH')))
 return <div className="page-stack">
  <div className="page-actions"><div><p className="page-intro">จัดการสิทธิ์การเข้าถึงของผู้ใช้งานในระบบ</p><label className="admin-search"><Search/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="ค้นหาชื่อ รหัส หรือแผนก"/></label></div><button className="btn primary" onClick={openCreate}><UserPlus size={18}/>เพิ่มผู้ใช้งาน</button></div>
  <section className="card"><div className="table-wrap"><table><thead><tr><th>ผู้ใช้งาน</th><th>รหัสพนักงาน</th><th>แผนก</th><th>บทบาท</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>{shown.map(user=><tr key={user.id}><td><div className="user-cell"><div className="avatar">{user.name.slice(0,2)}</div><b>{user.name}</b></div></td><td className="mono">{user.code}</td><td>{user.department}</td><td><span className={`role role-${user.role}`}><ShieldCheck size={14}/>{roleLabel[user.role]}</span></td><td><button className={`status ${user.active?'status-normal':'status-out'}`} onClick={()=>toggle(user)}>{user.active?'ใช้งาน':'ระงับ'}</button></td><td><button className="icon-action" aria-label={`แก้ไข ${user.name}`} onClick={()=>openEdit(user)}><Edit3 size={16}/>แก้ไข</button></td></tr>)}</tbody></table></div></section>
  {open&&<Modal title={editingId?'แก้ไขผู้ใช้งาน':'เพิ่มผู้ใช้งาน'} onClose={()=>setOpen(false)}><div className="modal-body form-grid"><label>ชื่อ–นามสกุล *<input value={form.name} onChange={event=>setForm({...form,name:event.target.value})}/></label><label>รหัสพนักงาน *<input value={form.code} onChange={event=>setForm({...form,code:event.target.value})}/></label><label>แผนก *<select value={form.department} onChange={event=>setForm({...form,department:event.target.value})}><option value="">เลือกแผนก</option>{DEPARTMENTS.map(value=><option value={value} key={value}>{value}</option>)}</select></label><label>บทบาท<select value={form.role} onChange={event=>setForm({...form,role:event.target.value as Role})}><option value="admin">ผู้ดูแลระบบ</option><option value="staff">เจ้าหน้าที่</option><option value="viewer">ผู้ดูข้อมูล</option></select></label></div><div className="modal-actions"><button className="btn secondary" onClick={()=>setOpen(false)}>ยกเลิก</button><button className="btn primary" onClick={save}>บันทึก</button></div></Modal>}
  {toast&&<Toast message={toast}/>}
 </div>
}

export function SettingsPage(){
 const {record}=useAudit()
 const [settings,setSettings]=useState<Settings>(()=>isSupabaseConfigured?defaults:{...defaults,...read<Partial<Settings>>(SETTINGS_KEY,{})});const [toast,setToast]=useState('')
 useEffect(()=>{if(isSupabaseConfigured)settingsService.load().then(setSettings).catch(error=>setToast(error instanceof Error?error.message:'โหลดการตั้งค่าไม่สำเร็จ'))},[])
 const save=async()=>{if(!settings.companyName.trim()||!settings.systemName.trim()||!settings.adminEmail.trim()){setToast('กรุณากรอกข้อมูลบริษัทให้ครบ');return}try{if(isSupabaseConfigured)await settingsService.save(settings);else localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings));record({action:'SETTINGS',entity:'settings',title:'การตั้งค่าระบบ',detail:'บันทึกข้อมูลบริษัทและการแจ้งเตือน'});setToast('บันทึกการตั้งค่าแล้ว')}catch(error){setToast(error instanceof Error?error.message:'บันทึกการตั้งค่าไม่สำเร็จ')}setTimeout(()=>setToast(''),2500)}
 return <div className="settings-grid">
  <section className="card"><div className="card-head"><div><h2>ข้อมูลบริษัท</h2><p>ข้อมูลที่แสดงในระบบและรายงาน</p></div></div><div className="form-stack settings-form"><label>ชื่อบริษัท<input value={settings.companyName} onChange={event=>setSettings({...settings,companyName:event.target.value})}/></label><label>ชื่อระบบ<input value={settings.systemName} onChange={event=>setSettings({...settings,systemName:event.target.value})}/></label><label>อีเมลผู้ดูแล<input value={settings.adminEmail} onChange={event=>setSettings({...settings,adminEmail:event.target.value})} type="email"/></label><button className="btn primary" onClick={save}><Save size={18}/>บันทึกการเปลี่ยนแปลง</button></div></section>
  <section className="card"><div className="card-head"><div><h2>การแจ้งเตือน</h2><p>เลือกเหตุการณ์ที่ต้องการรับการแจ้งเตือน</p></div></div><div className="toggle-list"><label><span><b>สินค้าใกล้หมด</b><small>แจ้งเมื่อจำนวนเท่ากับหรือต่ำกว่าสต็อกขั้นต่ำ</small></span><input type="checkbox" role="switch" checked={settings.lowStock} onChange={event=>setSettings({...settings,lowStock:event.target.checked})}/></label><label><span><b>สินค้าหมด</b><small>แจ้งทันทีเมื่อจำนวนคงเหลือเป็นศูนย์</small></span><input type="checkbox" role="switch" checked={settings.outOfStock} onChange={event=>setSettings({...settings,outOfStock:event.target.checked})}/></label><label><span><b>รายการต่ออายุ</b><small>แสดงป๊อปอัปเมื่อรายการเข้าเงื่อนไข</small></span><input type="checkbox" role="switch" checked={settings.renewals} onChange={event=>setSettings({...settings,renewals:event.target.checked})}/></label><label><span><b>สรุปรายสัปดาห์</b><small>เตรียมรายงานสรุปทุกเช้าวันจันทร์</small></span><input type="checkbox" role="switch" checked={settings.weekly} onChange={event=>setSettings({...settings,weekly:event.target.checked})}/></label><button className="btn secondary settings-test" onClick={()=>{setToast('ทดสอบการแจ้งเตือนสำเร็จ');setTimeout(()=>setToast(''),2500)}}>ทดสอบการแจ้งเตือน</button></div></section>
  {toast&&<Toast message={toast}/>}
 </div>
}
