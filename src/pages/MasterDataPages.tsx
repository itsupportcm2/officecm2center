import { Edit3, MapPin, Plus, Tags, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Modal, Toast } from '../components/ui'
import { useStock } from '../store/StockContext'
import { useAuth } from '../store/AuthContext'
import type { Category, Location } from '../types'

function MasterPage({kind}:{kind:'category'|'location'}){
 const store=useStock();const {user}=useAuth();const isCat=kind==='category';const data=isCat?store.categories:store.locations
 const [open,setOpen]=useState(false);const [editingId,setEditingId]=useState<string|null>(null);const [name,setName]=useState('');const [desc,setDesc]=useState('');const [toast,setToast]=useState('');const [saving,setSaving]=useState(false)
 const Icon=isCat?Tags:MapPin;const canDelete=user?.role==='admin';const canEditCategory=isCat&&(user?.role==='admin'||user?.role==='staff')
 const flash=(message:string)=>{setToast(message);window.setTimeout(()=>setToast(''),2500)}
 const close=()=>{setOpen(false);setEditingId(null);setName('');setDesc('')}
 const openCreate=()=>{setEditingId(null);setName('');setDesc('');setOpen(true)}
 const openEdit=(entry:Category|Location)=>{setEditingId(entry.id);setName(entry.name);setDesc(entry.description);setOpen(true)}
 const save=async()=>{
  const cleanName=name.trim();if(!cleanName||saving)return
  if(isCat&&store.categories.some(category=>category.id!==editingId&&category.name.trim().toLocaleLowerCase('th-TH')===cleanName.toLocaleLowerCase('th-TH'))){flash('ชื่อหมวดหมู่นี้มีอยู่แล้ว');return}
  setSaving(true)
  try{
   if(isCat&&editingId)await store.updateCategory({id:editingId,name:cleanName,description:desc.trim()})
   else if(isCat)await store.addCategory(cleanName,desc.trim())
   else await store.addLocation(cleanName,desc.trim())
   const edited=Boolean(editingId);close();flash(edited?'แก้ไขหมวดหมู่เรียบร้อย':'บันทึกข้อมูลเรียบร้อย')
  }catch(error){flash(error instanceof Error?error.message:'บันทึกข้อมูลไม่สำเร็จ')}
  finally{setSaving(false)}
 }
 return <div className="page-stack">
  <div className="page-actions"><p className="page-intro">{isCat?'จัดกลุ่มสินค้าเพื่อค้นหาและสรุปรายงานได้ง่ายขึ้น':'กำหนดห้อง คลัง หรือตำแหน่งที่ใช้จัดเก็บสินค้า'}</p><button className="btn primary" onClick={openCreate}><Plus size={18}/>{isCat?'เพิ่มหมวดหมู่':'เพิ่มตำแหน่ง'}</button></div>
  <section className="master-grid">{data.map(entry=>{const count=isCat?store.items.filter(item=>item.categoryId===entry.id).length:store.items.filter(item=>item.locationId===entry.id).length;return <article className="master-card" key={entry.id}><div className="master-icon"><Icon/></div><div><h3>{entry.name}</h3><p>{entry.description}</p><span>{count} รายการสินค้า</span></div><div className="master-actions">{canEditCategory&&<button className="icon-btn" title="แก้ไขชื่อหมวดหมู่" aria-label={`แก้ไข ${entry.name}`} onClick={()=>openEdit(entry)}><Edit3 size={18}/></button>}{canDelete&&<button className="icon-btn danger-text" disabled={count>0} title={count>0?'ยังมีสินค้าในรายการนี้':'ลบ'} onClick={()=>isCat?store.deleteCategory(entry.id):store.deleteLocation(entry.id)}><Trash2 size={18}/></button>}</div></article>})}</section>
  {open&&<Modal title={editingId?'แก้ไขหมวดหมู่':isCat?'เพิ่มหมวดหมู่':'เพิ่มตำแหน่งจัดเก็บ'} onClose={close}><div className="modal-body form-stack"><label>{isCat?'ชื่อหมวดหมู่':'ชื่อตำแหน่ง'} *<input value={name} onChange={event=>setName(event.target.value)} autoFocus/></label><label>คำอธิบาย<textarea value={desc} onChange={event=>setDesc(event.target.value)}/></label></div><div className="modal-actions"><button className="btn secondary" disabled={saving} onClick={close}>ยกเลิก</button><button className="btn primary" disabled={!name.trim()||saving} onClick={()=>void save()}>{saving?'กำลังบันทึก...':'บันทึก'}</button></div></Modal>}
  {toast&&<Toast message={toast}/>}
 </div>
}
export const CategoriesPage=()=> <MasterPage kind="category"/>
export const LocationsPage=()=> <MasterPage kind="location"/>
