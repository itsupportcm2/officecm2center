import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { isSupabaseConfigured } from '../lib/supabase'
import { auditService } from '../services/auditService'
import { useAuth } from './AuthContext'
import { useLocation } from 'react-router-dom'

export const AUDIT_STORAGE_KEY='cm-office-audit-v1'

export type AuditAction='CREATE'|'UPDATE'|'DELETE'|'STOCK_IN'|'STOCK_OUT'|'STOCK_ADJUST'|'STOCK_TRANSFER'|'PURCHASE_CREATE'|'PURCHASE_UPDATE'|'RENEW'|'BACKUP'|'RESTORE'|'SETTINGS'
export interface AuditEntry{
 id:string
 action:AuditAction
 entity:string
 entityId?:string
 title:string
 detail:string
 actor:string
 createdAt:string
}

const readEntries=():AuditEntry[]=>{try{const saved=localStorage.getItem(AUDIT_STORAGE_KEY);return saved?JSON.parse(saved):[]}catch{return []}}

interface AuditStore{
 entries:AuditEntry[]
 record:(entry:Omit<AuditEntry,'id'|'actor'|'createdAt'>)=>void
}

const AuditContext=createContext<AuditStore|null>(null)

export function AuditProvider({children}:{children:ReactNode}){
 const {user}=useAuth();const location=useLocation()
 const [entries,setEntries]=useState<AuditEntry[]>(()=>isSupabaseConfigured?[]:readEntries())
 useEffect(()=>{if(!isSupabaseConfigured||!user||user.role==='issuer'||user.role==='viewer'||location.pathname!=='/audit-log')return;let active=true;auditService.load().then(rows=>{if(active)setEntries(rows)}).catch(console.error);return()=>{active=false}},[user,location.pathname])
 const value=useMemo<AuditStore>(()=>({
  entries,
  record:entry=>{
   if(isSupabaseConfigured){if(user?.role==='issuer'||user?.role==='viewer')return;void auditService.record(entry).then(()=>location.pathname==='/audit-log'?auditService.load():null).then(rows=>{if(rows)setEntries(rows)}).catch(console.error);return}
   const next=[{...entry,id:crypto.randomUUID(),actor:user?.name??'ผู้ใช้งาน',createdAt:new Date().toISOString()},...readEntries()].slice(0,1000)
   localStorage.setItem(AUDIT_STORAGE_KEY,JSON.stringify(next))
   setEntries(next)
  },
 }),[entries,user,location.pathname])
 return <AuditContext.Provider value={value}>{children}</AuditContext.Provider>
}

export const useAudit=()=>{const value=useContext(AuditContext);if(!value)throw new Error('AuditProvider missing');return value}
