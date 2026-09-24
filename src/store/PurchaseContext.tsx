import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Item, PurchaseRequest } from '../types'
import { bangkokDateKey } from '../utils/date'
import { useAudit } from './AuditContext'
import { useAuth } from './AuthContext'

const STORAGE_KEY='cm-office-purchase-requests-v1'
const read=():PurchaseRequest[]=>{try{return JSON.parse(localStorage.getItem(STORAGE_KEY)??'[]')}catch{return []}}
const nextRequestNo=(count:number)=>`PR-${bangkokDateKey().replaceAll('-','')}-${String(count+1).padStart(3,'0')}`
interface Store{requests:PurchaseRequest[];createFromItems:(items:Item[])=>PurchaseRequest|null;updateStatus:(id:string,status:PurchaseRequest['status'])=>void;updateLine:(requestId:string,itemId:string,quantity:number)=>void;updateNote:(id:string,note:string)=>void}
const Context=createContext<Store|null>(null)

export function PurchaseProvider({children}:{children:ReactNode}){
 const {user}=useAuth();const {record}=useAudit();const [requests,setRequests]=useState<PurchaseRequest[]>(read)
 useEffect(()=>{localStorage.setItem(STORAGE_KEY,JSON.stringify(requests))},[requests])
 const value=useMemo<Store>(()=>({requests,
  createFromItems:items=>{const pendingIds=new Set(requests.filter(request=>request.status==='DRAFT'||request.status==='SUBMITTED').flatMap(request=>request.lines.map(line=>line.itemId)));const eligible=items.filter(item=>!pendingIds.has(item.id));if(!eligible.length)return null;const now=new Date().toISOString();const request:PurchaseRequest={id:crypto.randomUUID(),requestNo:nextRequestNo(requests.length),status:'DRAFT',lines:eligible.map(item=>({itemId:item.id,sku:item.sku,name:item.name,quantity:Math.max(item.minStock*2-item.quantity,1),unit:item.unit})),note:'สร้างจากรายการสินค้าใกล้หมด',requestedBy:user?.name??'ผู้ใช้งาน',createdAt:now,updatedAt:now};setRequests(current=>[request,...current]);record({action:'PURCHASE_CREATE',entity:'purchase_request',entityId:request.id,title:request.requestNo,detail:`สร้างใบขอซื้อ ${request.lines.length} รายการจากสินค้าใกล้หมด`});return request},
  updateStatus:(id,status)=>{const request=requests.find(row=>row.id===id);if(!request)return;setRequests(current=>current.map(row=>row.id===id?{...row,status,updatedAt:new Date().toISOString()}:row));record({action:'PURCHASE_UPDATE',entity:'purchase_request',entityId:id,title:request.requestNo,detail:`เปลี่ยนสถานะเป็น ${status}`})},
  updateLine:(requestId,itemId,quantity)=>setRequests(current=>current.map(request=>request.id===requestId?{...request,lines:request.lines.map(line=>line.itemId===itemId?{...line,quantity:Math.max(1,quantity)}:line),updatedAt:new Date().toISOString()}:request)),
  updateNote:(id,note)=>setRequests(current=>current.map(request=>request.id===id?{...request,note,updatedAt:new Date().toISOString()}:request)),
 }),[requests,user,record])
 return <Context.Provider value={value}>{children}</Context.Provider>
}
export const usePurchases=()=>{const value=useContext(Context);if(!value)throw new Error('PurchaseProvider missing');return value}
