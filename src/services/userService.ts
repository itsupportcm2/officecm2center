import type { Role } from '../types'
import { supabase } from '../lib/supabase'

export interface AdminUser {
  id:string; email:string; name:string; code:string; department:string; role:Role; active:boolean; lastSignInAt?:string|null
}

export interface UserInput {
  email?:string; password?:string; name:string; code:string; department:string; role:Role
}

async function invoke<T>(body:Record<string,unknown>):Promise<T>{
  if(!supabase)throw new Error('ยังไม่ได้เชื่อมต่อ Supabase')
  const {data,error}=await supabase.functions.invoke('manage-users',{body})
  if(error){
    const response=(error as {context?:Response}).context
    if(response){
      let message=''
      try{const detail=await response.clone().json() as {error?:string};message=detail.error??''}catch{/* use the fallback below */}
      if(message)throw new Error(message)
    }
    throw new Error('เรียกใช้ระบบจัดการผู้ใช้ไม่สำเร็จ กรุณาตรวจว่า deploy Edge Function แล้ว')
  }
  if(data?.error)throw new Error(String(data.error))
  return data as T
}

export const userService={
  async list(){const data=await invoke<{users:AdminUser[]}>({action:'list'});return data.users},
  async create(input:UserInput){await invoke({action:'create',...input})},
  async update(id:string,input:UserInput){await invoke({action:'update',id,...input})},
  async setActive(id:string,active:boolean){await invoke({action:'set-active',id,active})},
}
