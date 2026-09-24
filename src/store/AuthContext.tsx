import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type { Role } from '../types'

interface AuthUser { id:string; name:string; email:string; role:Role }
interface AuthStore { user:AuthUser|null; loading:boolean; signIn:(email:string,password:string)=>Promise<void>; signOut:()=>Promise<void> }
const Context=createContext<AuthStore|null>(null)
const DEMO_KEY='cm-office-demo-auth'
const demoUser:AuthUser={id:'demo-admin',name:'ณัฐพล',email:'admin@example.co.th',role:'admin'}
const demoProfiles:Record<Role,AuthUser>={
 admin:demoUser,
 staff:{id:'demo-staff',name:'กมลชนก วิเศษ',email:'staff@example.co.th',role:'staff'},
 viewer:{id:'demo-viewer',name:'สุภาวดี มีสุข',email:'viewer@example.co.th',role:'viewer'},
}
const readDemoUser=():AuthUser|null=>{const saved=sessionStorage.getItem(DEMO_KEY);if(saved==='signed-out')return null;if(!saved||saved==='signed-in')return demoUser;try{const parsed=JSON.parse(saved) as AuthUser;return parsed?.role?parsed:demoUser}catch{return demoUser}}

async function profileFromSession(session:Session|null):Promise<AuthUser|null>{
 if(!session||!supabase)return null
 const {data}=await supabase.from('profiles').select('full_name,role').eq('id',session.user.id).maybeSingle()
 return {id:session.user.id,name:data?.full_name??session.user.email??'ผู้ใช้งาน',email:session.user.email??'',role:(data?.role??'viewer') as Role}
}

export function AuthProvider({children}:{children:ReactNode}){
 const [user,setUser]=useState<AuthUser|null>(()=>!isSupabaseConfigured?readDemoUser():null)
 const [loading,setLoading]=useState(isSupabaseConfigured)
 useEffect(()=>{if(!supabase){setLoading(false);return}supabase.auth.getSession().then(async({data})=>{setUser(await profileFromSession(data.session));setLoading(false)});const {data}=supabase.auth.onAuthStateChange(async(_event,session)=>{setUser(await profileFromSession(session));setLoading(false)});return()=>data.subscription.unsubscribe()},[])
 const value=useMemo<AuthStore>(()=>({user,loading,
  signIn:async(email,password)=>{if(!supabase){const normalized=email.trim().toLowerCase();const role:Role=normalized.startsWith('viewer')?'viewer':normalized.startsWith('staff')?'staff':'admin';const demo={...demoProfiles[role],email:normalized||demoProfiles[role].email};sessionStorage.setItem(DEMO_KEY,JSON.stringify(demo));setUser(demo);return}const {data,error}=await supabase.auth.signInWithPassword({email,password});if(error)throw error;setUser(await profileFromSession(data.session))},
  signOut:async()=>{if(supabase)await supabase.auth.signOut();sessionStorage.setItem(DEMO_KEY,'signed-out');setUser(null)},
 }),[user,loading])
 return <Context.Provider value={value}>{children}</Context.Provider>
}
export const useAuth=()=>{const value=useContext(Context);if(!value)throw new Error('AuthProvider missing');return value}
