import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { isSupabaseConfigured } from '../lib/supabase'
import { issueRequestService } from '../services/issueRequestService'
import type { IssueRequest, NewIssueRequest } from '../types'
import { useAuth } from './AuthContext'
import { useStock } from './StockContext'

interface Store{requests:IssueRequest[];pending:IssueRequest[];loading:boolean;reload:()=>Promise<void>;create:(input:NewIssueRequest)=>Promise<void>;review:(id:string,decision:'APPROVED'|'REJECTED',reason?:string)=>Promise<void>;cancel:(id:string)=>Promise<void>}
const Context=createContext<Store|null>(null)

export function IssueRequestProvider({children}:{children:ReactNode}){
 const {user}=useAuth();const {reload:reloadStock}=useStock();const [requests,setRequests]=useState<IssueRequest[]>([]);const [loading,setLoading]=useState(false);const lastLoadAtRef=useRef(0)
 const reload=useCallback(async()=>{if(!isSupabaseConfigured||!user||user.role==='viewer'){setRequests([]);return}lastLoadAtRef.current=Date.now();setLoading(true);try{setRequests(await issueRequestService.load())}finally{setLoading(false)}},[user])
 useEffect(()=>{if(!user)return;void reload().catch(console.error);const refresh=()=>{if(document.visibilityState!=='visible'||Date.now()-lastLoadAtRef.current<15000)return;void reload().catch(console.error)};window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);const timer=user.role==='admin'||user.role==='staff'?window.setInterval(refresh,20000):undefined;return()=>{window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);if(timer)window.clearInterval(timer)}},[user,reload])
 const value=useMemo<Store>(()=>({requests,pending:requests.filter(row=>row.status==='PENDING'),loading,reload,
  create:async input=>{await issueRequestService.create(input);await reload()},
  review:async(id,decision,reason)=>{await issueRequestService.review(id,decision,reason);await Promise.all([reload(),reloadStock()])},
  cancel:async id=>{await issueRequestService.cancel(id);await reload()},
 }),[requests,loading,reload,reloadStock])
 return <Context.Provider value={value}>{children}</Context.Provider>
}
export const useIssueRequests=()=>{const value=useContext(Context);if(!value)throw new Error('IssueRequestProvider missing');return value}
