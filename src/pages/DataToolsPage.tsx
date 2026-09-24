import { DatabaseBackup, FileCheck2, HardDriveDownload, RotateCcw, ShieldCheck } from 'lucide-react'
import { useRef, useState, type ChangeEvent } from 'react'
import { Confirm, Toast } from '../components/ui'
import { downloadLocalBackup, parseLocalBackup, restoreLocalBackup, type LocalBackupFile } from '../services/localBackup'
import { AUDIT_STORAGE_KEY, useAudit, type AuditEntry } from '../store/AuditContext'
import { useAuth } from '../store/AuthContext'
import { formatThaiDateTime } from '../utils/date'

export function DataToolsPage(){
 const inputRef=useRef<HTMLInputElement>(null)
 const {record}=useAudit();const {user}=useAuth()
 const [pending,setPending]=useState<LocalBackupFile|null>(null)
 const [toast,setToast]=useState('')
 const flash=(message:string)=>{setToast(message);setTimeout(()=>setToast(''),2800)}
 const backup=()=>{record({action:'BACKUP',entity:'system',title:'สำรองข้อมูลภายในเครื่อง',detail:'ส่งออกข้อมูลระบบเป็นไฟล์ JSON'});const file=downloadLocalBackup();flash(`สำรองข้อมูลแล้ว ${formatThaiDateTime(file.exportedAt)}`)}
 const selectFile=async(event:ChangeEvent<HTMLInputElement>)=>{const file=event.target.files?.[0];event.target.value='';if(!file)return;try{setPending(parseLocalBackup(await file.text()))}catch(error){flash(error instanceof Error?error.message:'ไม่สามารถอ่านไฟล์ได้')}}
 const restore=()=>{if(!pending)return;restoreLocalBackup(pending);const existing:AuditEntry[]=(()=>{try{return JSON.parse(localStorage.getItem(AUDIT_STORAGE_KEY)??'[]')}catch{return []}})();const entry:AuditEntry={id:crypto.randomUUID(),action:'RESTORE',entity:'system',title:'กู้คืนข้อมูลภายในเครื่อง',detail:`กู้คืนจากไฟล์สำรองวันที่ ${formatThaiDateTime(pending.exportedAt)}`,actor:user?.name??'ผู้ใช้งาน',createdAt:new Date().toISOString()};localStorage.setItem(AUDIT_STORAGE_KEY,JSON.stringify([entry,...existing].slice(0,1000)));window.location.reload()}
 return <div className="page-stack">
  <section className="data-hero"><span><DatabaseBackup/></span><div><h2>สำรองและกู้คืนข้อมูล</h2><p>ใช้สำหรับโหมดทดสอบภายในเครื่อง ก่อนเชื่อมต่อฐานข้อมูลกลาง</p></div><span className="local-badge"><ShieldCheck/>ข้อมูลอยู่ในเครื่องนี้</span></section>
  <div className="data-tool-grid"><section className="card data-tool-card"><span className="data-tool-icon backup"><HardDriveDownload/></span><div><h3>สำรองข้อมูลทั้งหมด</h3><p>ดาวน์โหลดสินค้า ประวัติสต็อก รายการต่ออายุ ผู้ใช้ การตั้งค่า และบันทึกกิจกรรมเป็นไฟล์ JSON</p><ul><li>ควรสำรองก่อนทดสอบฟังก์ชันสำคัญ</li><li>เก็บไฟล์ไว้ในโฟลเดอร์ที่เข้าถึงได้เฉพาะผู้ดูแล</li></ul></div><button className="btn primary" onClick={backup}><HardDriveDownload size={18}/>ดาวน์โหลดไฟล์สำรอง</button></section>
  <section className="card data-tool-card"><span className="data-tool-icon restore"><RotateCcw/></span><div><h3>กู้คืนจากไฟล์สำรอง</h3><p>นำข้อมูลจากไฟล์สำรองกลับมาแทนข้อมูลที่อยู่ในเบราว์เซอร์ปัจจุบัน</p><ul><li>ระบบจะตรวจชนิดและเวอร์ชันของไฟล์ก่อน</li><li>หน้าเว็บจะรีโหลดหลังยืนยันการกู้คืน</li></ul></div><input ref={inputRef} hidden type="file" accept="application/json,.json" onChange={selectFile}/><button className="btn secondary" onClick={()=>inputRef.current?.click()}><FileCheck2 size={18}/>เลือกไฟล์เพื่อกู้คืน</button></section></div>
  <section className="data-note"><b>ข้อควรทราบ</b><p>ไฟล์สำรองอาจมีข้อมูลภายในบริษัท ไม่ควรส่งต่อผ่านช่องทางสาธารณะ และควรทดสอบกู้คืนเป็นระยะ</p></section>
  {pending&&<Confirm title="ยืนยันการกู้คืนข้อมูล" detail={`ข้อมูลปัจจุบันในเบราว์เซอร์จะถูกแทนที่ด้วยไฟล์สำรองวันที่ ${formatThaiDateTime(pending.exportedAt)} การดำเนินการนี้ย้อนกลับไม่ได้หากไม่มีไฟล์สำรองเดิม`} onCancel={()=>setPending(null)} onConfirm={restore}/>} {toast&&<Toast message={toast}/>}
 </div>
}
