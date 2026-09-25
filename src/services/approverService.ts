import { EMPLOYEES } from '../constants/employees'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

export interface Approver { id:string; name:string; active:boolean }

const localKey='cm-office-approvers-v1'
const localDefaults:Approver[]=EMPLOYEES.map((name,index)=>({id:`local-${index+1}`,name,active:true}))
const readLocal=():Approver[]=>{try{const value=localStorage.getItem(localKey);return value?JSON.parse(value):localDefaults}catch{return localDefaults}}
const writeLocal=(rows:Approver[])=>localStorage.setItem(localKey,JSON.stringify(rows))
const map=(row:any):Approver=>({id:String(row.id),name:String(row.name),active:Boolean(row.is_active)})

export const approverService={
  async list(includeInactive=false):Promise<Approver[]>{
    if(!isSupabaseConfigured||!supabase)return readLocal().filter(row=>includeInactive||row.active)
    let query=supabase.from('approvers').select('id,name,is_active').order('name')
    if(!includeInactive)query=query.eq('is_active',true)
    const {data,error}=await query
    if(error)throw error
    return (data??[]).map(map)
  },
  async create(name:string):Promise<void>{
    const clean=name.trim()
    if(!clean)throw new Error('กรุณากรอกชื่อผู้อนุมัติ')
    if(!isSupabaseConfigured||!supabase){const rows=readLocal();if(rows.some(row=>row.name.toLocaleLowerCase('th-TH')===clean.toLocaleLowerCase('th-TH')))throw new Error('รายชื่อนี้มีอยู่แล้ว');writeLocal([...rows,{id:crypto.randomUUID(),name:clean,active:true}]);return}
    const {error}=await supabase.from('approvers').insert({name:clean})
    if(error)throw error
  },
  async update(id:string,name:string,active:boolean):Promise<void>{
    const clean=name.trim()
    if(!clean)throw new Error('กรุณากรอกชื่อผู้อนุมัติ')
    if(!isSupabaseConfigured||!supabase){writeLocal(readLocal().map(row=>row.id===id?{...row,name:clean,active}:row));return}
    const {error}=await supabase.from('approvers').update({name:clean,is_active:active}).eq('id',id)
    if(error)throw error
  },
}
