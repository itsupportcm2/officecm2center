import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Item, PurchaseRequest } from '../types'
import { bangkokDateKey } from '../utils/date'
import { useAudit } from './AuditContext'
import { useAuth } from './AuthContext'
import { isSupabaseConfigured } from '../lib/supabase'
import { purchaseService } from '../services/purchaseService'

const STORAGE_KEY='cm-office-purchase-requests-v1'
const read=():PurchaseRequest[]=>{try{return JSON.parse(localStorage.getItem(STORAGE_KEY)??'[]')}catch{return []}}
const nextRequestNo=(count:number)=>`PR-${bangkokDateKey().replaceAll('-','')}-${String(count+1).padStart(3,'0')}`
interface Store{requests:PurchaseRequest[];createFromItems:(items:Item[])=>Promise<PurchaseRequest|null>;updateStatus:(id:string,status:PurchaseRequest['status'])=>Promise<void>;updateLine:(requestId:string,itemId:string,quantity:number)=>Promise<void>;updateNote:(id:string,note:string)=>Promise<void>}
const Context=createContext<Store|null>(null)

export function PurchaseProvider({children}:{children:ReactNode}){
 const {user}=useAuth();const {record}=useAudit();const [requests,setRequests]=useState<PurchaseRequest[]>(()=>isSupabaseConfigured?[]:read())
 const reload=async()=>setRequests(await purchaseService.load())
 useEffect(()=>{if(isSupabaseConfigured&&user)void reload().catch(console.error)},[user])
 useEffect(()=>{if(!isSupabaseConfigured)localStorage.setItem(STORAGE_KEY,JSON.stringify(requests))},[requests])
 const value=useMemo<Store>(()=>({requests,
  createFromItems:async items=>{const pendingIds=new Set(requests.filter(request=>request.status==='DRAFT'||request.status==='SUBMITTED').flatMap(request=>request.lines.map(line=>line.itemId)));const eligible=items.filter(item=>!pendingIds.has(item.id));if(!eligible.length)return null;if(isSupabaseConfigured){await purchaseService.create(eligible);const rows=await purchaseService.load();setRequests(rows);const created=rows[0]??null;if(created)record({action:'PURCHASE_CREATE',entity:'purchase_request',entityId:created.id,title:created.requestNo,detail:`สร้างใบขอซื้อ ${created.lines.length} รายการ`});return created}const now=new Date().toISOString();const request:PurchaseRequest={id:crypto.randomUUID(),requestNo:nextRequestNo(requests.length),status:'DRAFT',lines:eligible.map(item=>({itemId:item.id,sku:item.sku,name:item.name,quantity:Math.max(item.minStock*2-item.quantity,1),unit:item.unit})),note:'สร้างจากรายการสินค้าใกล้หมด',requestedBy:user?.name??'ผู้ใช้งาน',createdAt:now,updatedAt:now};setRequests(current=>[request,...current]);record({action:'PURCHASE_CREATE',entity:'purchase_request',entityId:request.id,title:request.requestNo,detail:`สร้างใบขอซื้อ ${request.lines.length} รายการจากสินค้าใกล้หมด`});return request},
  updateStatus:async(id,status)=>{const request=requests.find(row=>row.id===id);if(!request)return;setRequests(current=>current.map(row=>row.id===id?{...row,status,updatedAt:new Date().toISOString()}:row));if(isSupabaseConfigured){try{await purchaseService.updateStatus(id,status)}catch(error){await reload();throw error}}record({action:'PURCHASE_UPDATE',entity:'purchase_request',entityId:id,title:request.requestNo,detail:`เปลี่ยนสถานะเป็น ${status}`})},
  updateLine:async(requestId,itemId,quantity)=>{setRequests(current=>current.map(request=>request.id===requestId?{...request,lines:request.lines.map(line=>line.itemId===itemId?{...line,quantity:Math.max(1,quantity)}:line),updatedAt:new Date().toISOString()}:request));if(isSupabaseConfigured){try{await purchaseService.updateLine(requestId,itemId,quantity)}catch(error){await reload();throw error}}},
  updateNote:async(id,note)=>{setRequests(current=>current.map(request=>request.id===id?{...request,note,updatedAt:new Date().toISOString()}:request));if(isSupabaseConfigured){try{await purchaseService.updateNote(id,note)}catch(error){await reload();throw error}}},
 }),[requests,user,record])
 return <Context.Provider value={value}>{children}</Context.Provider>
}
export const usePurchases=()=>{const value=useContext(Context);if(!value)throw new Error('PurchaseProvider missing');return value}
