import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from './AuthContext'

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
 const {user}=useAuth()
 const [entries,setEntries]=useState<AuditEntry[]>(readEntries)
 const value=useMemo<AuditStore>(()=>({
  entries,
  record:entry=>{
   const next=[{...entry,id:crypto.randomUUID(),actor:user?.name??'ผู้ใช้งาน',createdAt:new Date().toISOString()},...readEntries()].slice(0,1000)
   localStorage.setItem(AUDIT_STORAGE_KEY,JSON.stringify(next))
   setEntries(next)
  },
 }),[entries,user])
 return <AuditContext.Provider value={value}>{children}</AuditContext.Provider>
}

export const useAudit=()=>{const value=useContext(AuditContext);if(!value)throw new Error('AuditProvider missing');return value}
