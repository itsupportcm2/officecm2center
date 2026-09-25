import { Edit3, Save, Search, ShieldCheck, UserPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Modal, Toast } from '../components/ui'
import { useAudit } from '../store/AuditContext'
import { DEPARTMENTS } from '../constants/departments'
import type { Role } from '../types'
import { isSupabaseConfigured } from '../lib/supabase'
import { defaultSettings, settingsService, type AppSettings } from '../services/settingsService'
import { userService, type AdminUser } from '../services/userService'

type Settings=AppSettings

const USER_KEY='cm-office-users-v1'
const SETTINGS_KEY='cm-office-settings-v1'
const seedUsers:AdminUser[]=[
 {id:'u1',email:'admin@example.co.th',name:'ณัฐพล พรหมดี',code:'EMP-001',department:'IT',role:'admin',active:true},
 {id:'u2',email:'staff@example.co.th',name:'กมลชนก วิเศษ',code:'EMP-014',department:'ST',role:'staff',active:true},
 {id:'u3',email:'viewer@example.co.th',name:'สุภาวดี มีสุข',code:'EMP-027',department:'AC',role:'viewer',active:true},
 {id:'u4',email:'staff2@example.co.th',name:'วีรพล ตั้งมั่น',code:'EMP-031',department:'EC',role:'staff',active:true},
]
const defaults:Settings=defaultSettings
const read=<T,>(key:string,fallback:T):T=>{try{const value=localStorage.getItem(key);return value?JSON.parse(value):fallback}catch{return fallback}}
const roleLabel:Record<Role,string>={admin:'ผู้ดูแลระบบ',staff:'เจ้าหน้าที่',viewer:'ผู้ดูข้อมูล'}

export function UsersPage(){
 const {record}=useAudit()
 const [users,setUsers]=useState<AdminUser[]>(()=>isSupabaseConfigured?[]:read(USER_KEY,seedUsers))
 const [open,setOpen]=useState(false);const [editingId,setEditingId]=useState<string|null>(null);const [query,setQuery]=useState('');const [toast,setToast]=useState('');const [loading,setLoading]=useState(isSupabaseConfigured);const [saving,setSaving]=useState(false)
 const [form,setForm]=useState({email:'',password:'',name:'',code:'',department:'',role:'staff' as Role})
 const flash=(message:string)=>{setToast(message);setTimeout(()=>setToast(''),2500)}
 const loadUsers=async()=>{if(!isSupabaseConfigured)return;setLoading(true);try{setUsers(await userService.list())}catch(error){flash(error instanceof Error?error.message:'โหลดผู้ใช้งานไม่สำเร็จ')}finally{setLoading(false)}}
 useEffect(()=>{void loadUsers()},[])
 const save=async()=>{
  if(!form.name||!form.code||!form.department||(!editingId&&(!form.email||form.password.length<8))){flash('กรุณากรอกข้อมูลให้ครบ และใช้รหัสผ่านอย่างน้อย 8 ตัวอักษร');return}
  if(users.some(user=>user.id!==editingId&&user.code.toLowerCase()===form.code.trim().toLowerCase())){flash('รหัสพนักงานนี้มีอยู่แล้ว');return}
  setSaving(true);try{
   if(isSupabaseConfigured){if(editingId)await userService.update(editingId,form);else await userService.create(form);await loadUsers()}
   else if(editingId){const next=users.map(user=>user.id===editingId?{...user,...form,code:form.code.trim()}:user);setUsers(next);localStorage.setItem(USER_KEY,JSON.stringify(next));record({action:'UPDATE',entity:'user',entityId:editingId,title:form.name,detail:`แก้ไขผู้ใช้งาน ${form.code}`})}
   else{const created={...form,code:form.code.trim(),id:crypto.randomUUID(),active:true,lastSignInAt:null};const next=[...users,created];setUsers(next);localStorage.setItem(USER_KEY,JSON.stringify(next));record({action:'CREATE',entity:'user',entityId:created.id,title:created.name,detail:`เพิ่มผู้ใช้งาน ${created.code} บทบาท ${roleLabel[created.role]}`})}
   flash(editingId?'แก้ไขผู้ใช้งานแล้ว':'สร้างบัญชีผู้ใช้งานแล้ว');setOpen(false);setEditingId(null);setForm({email:'',password:'',name:'',code:'',department:'',role:'staff'})
  }catch(error){flash(error instanceof Error?error.message:'บันทึกผู้ใช้งานไม่สำเร็จ')}finally{setSaving(false)}
 }
 const openCreate=()=>{setEditingId(null);setForm({email:'',password:'',name:'',code:'',department:'',role:'staff'});setOpen(true)}
 const openEdit=(user:AdminUser)=>{setEditingId(user.id);setForm({email:user.email,password:'',name:user.name,code:user.code,department:user.department,role:user.role});setOpen(true)}
 const toggle=async(user:AdminUser)=>{try{const active=!user.active;if(isSupabaseConfigured){await userService.setActive(user.id,active);await loadUsers()}else{const next=users.map(row=>row.id===user.id?{...row,active}:row);setUsers(next);localStorage.setItem(USER_KEY,JSON.stringify(next));record({action:'UPDATE',entity:'user',entityId:user.id,title:user.name,detail:active?'เปิดใช้งานผู้ใช้':'ระงับผู้ใช้งาน'})}flash(active?'เปิดใช้งานผู้ใช้แล้ว':'ระงับผู้ใช้งานแล้ว')}catch(error){flash(error instanceof Error?error.message:'เปลี่ยนสถานะไม่สำเร็จ')}}
 const shown=users.filter(user=>`${user.name} ${user.email} ${user.code} ${user.department}`.toLocaleLowerCase('th-TH').includes(query.trim().toLocaleLowerCase('th-TH')))
 return <div className="page-stack">
  <div className="page-actions"><div><p className="page-intro">จัดการสิทธิ์การเข้าถึงของผู้ใช้งานในระบบ</p><label className="admin-search"><Search/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="ค้นหาชื่อ รหัส หรือแผนก"/></label></div><button className="btn primary" onClick={openCreate}><UserPlus size={18}/>เพิ่มผู้ใช้งาน</button></div>
  <section className="card"><div className="table-wrap"><table><thead><tr><th>ผู้ใช้งาน</th><th>อีเมล</th><th>รหัสพนักงาน</th><th>แผนก</th><th>บทบาท</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>{!loading&&shown.map(user=><tr key={user.id}><td><div className="user-cell"><div className="avatar">{user.name.slice(0,2)}</div><b>{user.name}</b></div></td><td>{user.email||'—'}</td><td className="mono">{user.code}</td><td>{user.department}</td><td><span className={`role role-${user.role}`}><ShieldCheck size={14}/>{roleLabel[user.role]}</span></td><td><button className={`status ${user.active?'status-normal':'status-out'}`} onClick={()=>void toggle(user)}>{user.active?'ใช้งาน':'ระงับ'}</button></td><td><button className="icon-action" aria-label={`แก้ไข ${user.name}`} onClick={()=>openEdit(user)}><Edit3 size={16}/>แก้ไข</button></td></tr>)}</tbody></table>{loading&&<div className="empty">กำลังโหลดผู้ใช้งาน...</div>}{!loading&&!shown.length&&<div className="empty">ไม่พบผู้ใช้งาน</div>}</div></section>
  {open&&<Modal title={editingId?'แก้ไขผู้ใช้งาน':'เพิ่มผู้ใช้งาน'} onClose={()=>setOpen(false)}><div className="modal-body form-grid"><label>อีเมล *<input type="email" value={form.email} disabled={Boolean(editingId)} onChange={event=>setForm({...form,email:event.target.value})}/></label>{!editingId&&<label>รหัสผ่านเริ่มต้น *<input type="password" minLength={8} value={form.password} onChange={event=>setForm({...form,password:event.target.value})} placeholder="อย่างน้อย 8 ตัวอักษร"/></label>}<label>ชื่อ–นามสกุล *<input value={form.name} onChange={event=>setForm({...form,name:event.target.value})}/></label><label>รหัสพนักงาน *<input value={form.code} onChange={event=>setForm({...form,code:event.target.value})}/></label><label>แผนก *<select value={form.department} onChange={event=>setForm({...form,department:event.target.value})}><option value="">เลือกแผนก</option>{DEPARTMENTS.map(value=><option value={value} key={value}>{value}</option>)}</select></label><label>บทบาท<select value={form.role} onChange={event=>setForm({...form,role:event.target.value as Role})}><option value="admin">ผู้ดูแลระบบ</option><option value="staff">เจ้าหน้าที่</option><option value="viewer">ผู้ดูข้อมูล</option></select></label></div><div className="modal-actions"><button className="btn secondary" disabled={saving} onClick={()=>setOpen(false)}>ยกเลิก</button><button className="btn primary" disabled={saving} onClick={()=>void save()}>{saving?'กำลังบันทึก...':'บันทึก'}</button></div></Modal>}
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
