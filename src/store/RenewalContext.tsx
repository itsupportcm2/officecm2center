import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { RenewalActionInput, RenewalHistoryEntry, RenewalItem } from '../types'
import { isSupabaseConfigured } from '../lib/supabase'
import { renewalService } from '../services/renewalService'
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
 addItem:(item:Omit<RenewalItem,'id'|'updatedAt'>)=>Promise<void>;
 updateItem:(item:RenewalItem)=>Promise<void>; removeItem:(id:string)=>Promise<void>; renewItem:(id:string,input:RenewalActionInput)=>Promise<void>;
}
const RenewalContext=createContext<RenewalStore|null>(null)

export function RenewalProvider({children}:{children:ReactNode}){
 const {record}=useAudit();const {user}=useAuth()
 const [items,setItems]=useState<RenewalItem[]>(()=>{if(isSupabaseConfigured)return [];try{const saved=localStorage.getItem(STORAGE_KEY);const parsed:RenewalItem[]=saved?JSON.parse(saved):initialRenewals;return parsed.map(item=>({...item,owner:normalizeOwner(item.owner),cycleCount:item.cycleCount??1,cycleUnit:item.cycleUnit??'year'}))}catch{return initialRenewals}})
 const [history,setHistory]=useState<RenewalHistoryEntry[]>(()=>{if(isSupabaseConfigured)return [];try{return JSON.parse(localStorage.getItem(HISTORY_KEY)??'[]')}catch{return []}})
 const reload=async()=>{const data=await renewalService.load();setItems(data.items);setHistory(data.history)}
 useEffect(()=>{if(!isSupabaseConfigured||!user)return;void reload().catch(console.error)},[user])
 useEffect(()=>{if(!isSupabaseConfigured)localStorage.setItem(STORAGE_KEY,JSON.stringify(items))},[items])
 useEffect(()=>{if(!isSupabaseConfigured)localStorage.setItem(HISTORY_KEY,JSON.stringify(history))},[history])
 const dueItems=useMemo(()=>items.filter(item=>item.isActive&&daysUntil(item.expiryDate)<=item.remindDays).sort((a,b)=>a.expiryDate.localeCompare(b.expiryDate)),[items])
 const value=useMemo<RenewalStore>(()=>({items,dueItems,history,
  addItem:async item=>{if(isSupabaseConfigured){await renewalService.create(item);await reload();record({action:'CREATE',entity:'renewal',title:item.name,detail:`เพิ่มรายการต่ออายุ กำหนด ${item.expiryDate}`});return}const id=crypto.randomUUID();setItems(current=>[{...item,id,updatedAt:new Date().toISOString()},...current]);record({action:'CREATE',entity:'renewal',entityId:id,title:item.name,detail:`เพิ่มรายการต่ออายุ กำหนด ${item.expiryDate}`})},
  updateItem:async item=>{if(isSupabaseConfigured){await renewalService.update(item);await reload();record({action:'UPDATE',entity:'renewal',entityId:item.id,title:item.name,detail:`แก้ไขรายการต่ออายุ กำหนด ${item.expiryDate}`});return}setItems(current=>current.map(row=>row.id===item.id?{...item,updatedAt:new Date().toISOString()}:row));record({action:'UPDATE',entity:'renewal',entityId:item.id,title:item.name,detail:`แก้ไขรายการต่ออายุ กำหนด ${item.expiryDate}`})},
  removeItem:async id=>{const item=items.find(row=>row.id===id);if(isSupabaseConfigured){await renewalService.remove(id);await reload();record({action:'DELETE',entity:'renewal',entityId:id,title:item?.name??id,detail:'ลบรายการต่ออายุ'});return}setItems(current=>current.filter(row=>row.id!==id));record({action:'DELETE',entity:'renewal',entityId:id,title:item?.name??id,detail:'ลบรายการต่ออายุ'})},
  renewItem:async(id,input)=>{const item=items.find(row=>row.id===id);if(!item)return;if(isSupabaseConfigured){await renewalService.renew(item,input);await reload();record({action:'RENEW',entity:'renewal',entityId:id,title:item.name,detail:`ต่ออายุจาก ${item.expiryDate} เป็น ${input.newExpiryDate}`});return}const now=new Date().toISOString();const entry:RenewalHistoryEntry={id:crypto.randomUUID(),renewalId:id,itemName:item.name,previousExpiryDate:item.expiryDate,newExpiryDate:input.newExpiryDate,cost:input.cost,documentUrl:input.documentUrl,renewedBy:user?.name??'ผู้ใช้งาน',renewedAt:now};setHistory(current=>[entry,...current]);setItems(current=>current.map(row=>row.id===id?{...row,expiryDate:input.newExpiryDate,lastRenewedAt:now,updatedAt:now}:row));record({action:'RENEW',entity:'renewal',entityId:id,title:item.name,detail:`ต่ออายุจาก ${item.expiryDate} เป็น ${input.newExpiryDate}`})},
 }),[items,dueItems,history,record,user])
 return <RenewalContext.Provider value={value}>{children}</RenewalContext.Provider>
}
export const useRenewals=()=>{const value=useContext(RenewalContext);if(!value)throw new Error('RenewalProvider missing');return value}
