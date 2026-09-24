import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { RenewalHistoryEntry, RenewalItem } from '../types'
import { useAudit } from './AuditContext'
import { useAuth } from './AuthContext'

const STORAGE_KEY='cm-office-renewals-v1'
const HISTORY_KEY='cm-office-renewal-history-v1'
const addDays=(days:number)=>{const date=new Date();date.setHours(12,0,0,0);date.setDate(date.getDate()+days);return date.toISOString().slice(0,10)}
const normalizeOwner=(owner:string)=>({'ฝ่ายธุรการ':'ST','ฝ่ายบริหาร':'AC','ฝ่ายบัญชี':'AC'}[owner]??owner)
const initialRenewals:RenewalItem[]=[
 {id:'renew-1',name:'ภาษีรถยนต์สำนักงาน ทะเบียน กข 1234',category:'ภาษีและทะเบียน',expiryDate:addDays(7),remindDays:30,owner:'ST',note:'เตรียมสำเนาทะเบียนรถและ พ.ร.บ.',isActive:true,cycleCount:1,cycleUnit:'year',updatedAt:new Date().toISOString()},
 {id:'renew-2',name:'ประกันภัยรถยนต์สำนักงาน',category:'ประกันภัย',expiryDate:addDays(18),remindDays:30,owner:'ST',note:'เปรียบเทียบเบี้ยประกันก่อนต่ออายุ',isActive:true,cycleCount:1,cycleUnit:'year',updatedAt:new Date().toISOString()},
 {id:'renew-3',name:'ใบอนุญาตประกอบกิจการ',category:'ใบอนุญาต',expiryDate:addDays(75),remindDays:45,owner:'AC',note:'',isActive:true,cycleCount:1,cycleUnit:'year',updatedAt:new Date().toISOString()},
]

export const daysUntil=(date:string)=>{const today=new Date();today.setHours(0,0,0,0);const due=new Date(`${date}T00:00:00`);return Math.ceil((due.getTime()-today.getTime())/86400000)}

interface RenewalStore {
 items:RenewalItem[]; dueItems:RenewalItem[]; history:RenewalHistoryEntry[];
 addItem:(item:Omit<RenewalItem,'id'|'updatedAt'>)=>void;
 updateItem:(item:RenewalItem)=>void; removeItem:(id:string)=>void; renewItem:(id:string)=>void;
}
const RenewalContext=createContext<RenewalStore|null>(null)

export function RenewalProvider({children}:{children:ReactNode}){
 const {record}=useAudit();const {user}=useAuth()
 const [items,setItems]=useState<RenewalItem[]>(()=>{try{const saved=localStorage.getItem(STORAGE_KEY);const parsed:RenewalItem[]=saved?JSON.parse(saved):initialRenewals;return parsed.map(item=>({...item,owner:normalizeOwner(item.owner),cycleCount:item.cycleCount??1,cycleUnit:item.cycleUnit??'year'}))}catch{return initialRenewals}})
 const [history,setHistory]=useState<RenewalHistoryEntry[]>(()=>{try{return JSON.parse(localStorage.getItem(HISTORY_KEY)??'[]')}catch{return []}})
 useEffect(()=>{localStorage.setItem(STORAGE_KEY,JSON.stringify(items))},[items])
 useEffect(()=>{localStorage.setItem(HISTORY_KEY,JSON.stringify(history))},[history])
 const dueItems=useMemo(()=>items.filter(item=>item.isActive&&daysUntil(item.expiryDate)<=item.remindDays).sort((a,b)=>a.expiryDate.localeCompare(b.expiryDate)),[items])
 const value=useMemo<RenewalStore>(()=>({items,dueItems,history,
  addItem:item=>{const id=crypto.randomUUID();setItems(current=>[{...item,id,updatedAt:new Date().toISOString()},...current]);record({action:'CREATE',entity:'renewal',entityId:id,title:item.name,detail:`เพิ่มรายการต่ออายุ กำหนด ${item.expiryDate}`})},
  updateItem:item=>{setItems(current=>current.map(row=>row.id===item.id?{...item,updatedAt:new Date().toISOString()}:row));record({action:'UPDATE',entity:'renewal',entityId:item.id,title:item.name,detail:`แก้ไขรายการต่ออายุ กำหนด ${item.expiryDate}`})},
  removeItem:id=>{const item=items.find(row=>row.id===id);setItems(current=>current.filter(row=>row.id!==id));record({action:'DELETE',entity:'renewal',entityId:id,title:item?.name??id,detail:'ลบรายการต่ออายุ'})},
  renewItem:id=>{const item=items.find(row=>row.id===id);if(!item)return;const next=new Date(`${item.expiryDate}T12:00:00`);if(item.cycleUnit==='month')next.setMonth(next.getMonth()+item.cycleCount);else next.setFullYear(next.getFullYear()+item.cycleCount);const expiryDate=next.toISOString().slice(0,10);const now=new Date().toISOString();const entry:RenewalHistoryEntry={id:crypto.randomUUID(),renewalId:id,itemName:item.name,previousExpiryDate:item.expiryDate,newExpiryDate:expiryDate,cost:item.cost??0,documentUrl:item.documentUrl,renewedBy:user?.name??'ผู้ใช้งาน',renewedAt:now};setHistory(current=>[entry,...current]);setItems(current=>current.map(row=>row.id===id?{...row,expiryDate,lastRenewedAt:now,updatedAt:now}:row));record({action:'RENEW',entity:'renewal',entityId:id,title:item.name,detail:`ต่ออายุจาก ${item.expiryDate} เป็น ${expiryDate}`})},
 }),[items,dueItems,history,record,user])
 return <RenewalContext.Provider value={value}>{children}</RenewalContext.Provider>
}
export const useRenewals=()=>{const value=useContext(RenewalContext);if(!value)throw new Error('RenewalProvider missing');return value}
