import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { categories as initialCategories, items as initialItems, locations as initialLocations, transactions as initialTransactions } from '../data/mockData'
import { isSupabaseConfigured } from '../lib/supabase'
import { inventoryService } from '../services/inventoryService'
import { stockService } from '../services/stockService'
import type { Category, Item, Location, StockAdjustmentInput, StockChangeInput, StockTransaction, StockTransferInput, TransactionType } from '../types'
import { nextAverageUnitCost, type LocationBalances } from '../utils/stock'
import { readStockSnapshot, writeStockSnapshot } from '../utils/stockCache'
import { beginTiming, reportTiming } from '../utils/performance'
import { useAudit } from './AuditContext'
import { useAuth } from './AuthContext'

const KEYS={items:'cm-office-items-v2',categories:'cm-office-categories-v2',locations:'cm-office-locations-v2',transactions:'cm-office-transactions-v2',balances:'cm-office-balances-v1'}
const readLocal=<T,>(key:string,fallback:T):T=>{try{const saved=localStorage.getItem(key);return saved?JSON.parse(saved):fallback}catch{return fallback}}
const initialBalances=(items:Item[]):LocationBalances=>Object.fromEntries(items.map(item=>[item.id,{[item.locationId]:item.quantity}]))
type NewItem=Omit<Item,'id'|'createdAt'|'quantity'>

interface Store{
 items:Item[];categories:Category[];locations:Location[];transactions:StockTransaction[];balances:LocationBalances;loading:boolean;historyLoading:boolean;error:string|null
 reload:()=>Promise<void>;loadHistory:(itemId?:string)=>Promise<void>;getLocationQuantity:(itemId:string,locationId:string)=>number
 addItem:(item:NewItem)=>Promise<void>;importItems:(items:NewItem[])=>Promise<number>;updateItem:(item:Item)=>Promise<void>;deleteItem:(id:string)=>Promise<void>
 applyStock:(type:Extract<TransactionType,'IN'|'OUT'>,input:StockChangeInput)=>Promise<void>
 adjustStock:(input:StockAdjustmentInput)=>Promise<void>;transferStock:(input:StockTransferInput)=>Promise<void>
 addCategory:(name:string,description:string)=>Promise<void>;updateCategory:(category:Category)=>Promise<void>;deleteCategory:(id:string)=>Promise<void>
 addLocation:(name:string,description:string)=>Promise<void>;deleteLocation:(id:string)=>Promise<void>
}
const Context=createContext<Store|null>(null)

export const StockProvider=({children}:{children:ReactNode})=>{
 const {user}=useAuth();const {record}=useAudit();const localMode=!isSupabaseConfigured
 const userId=user?.id
 const userRole=user?.role
 const userName=user?.name
 const [items,setItems]=useState<Item[]>(()=>localMode?readLocal(KEYS.items,initialItems):[])
 const [categories,setCategories]=useState<Category[]>(()=>localMode?readLocal(KEYS.categories,initialCategories):[])
 const [locations,setLocations]=useState<Location[]>(()=>localMode?readLocal(KEYS.locations,initialLocations):[])
 const [transactions,setTransactions]=useState<StockTransaction[]>(()=>localMode?readLocal(KEYS.transactions,initialTransactions):[])
 const [balances,setBalances]=useState<LocationBalances>(()=>localMode?readLocal(KEYS.balances,initialBalances(readLocal(KEYS.items,initialItems))):{})
 const [loading,setLoading]=useState(false)
 const [historyLoading,setHistoryLoading]=useState(false)
 const [error,setError]=useState<string|null>(null)
 const hasDataRef=useRef(localMode)
 const loadTokenRef=useRef(0)
 const lastLoadAtRef=useRef(0)
 const fullHistoryLoadedRef=useRef(localMode)
 const loadedItemHistoryRef=useRef(new Set<string>())

 const reloadData=useCallback(async(showLoading=true)=>{
  if(localMode)return
  if(!userId)return
  const token=++loadTokenRef.current
  const startedAt=beginTiming()
  lastLoadAtRef.current=Date.now()
  if(showLoading)setLoading(true)
  try{
   const snapshot=await inventoryService.loadSnapshot(userRole,userName)
   const history=fullHistoryLoadedRef.current&&userRole!=='issuer'?await inventoryService.loadHistory(userRole,userName):snapshot.history
   if(token!==loadTokenRef.current)return
   const {inventory}=snapshot
   setItems(inventory.items);setCategories(inventory.categories);setLocations(inventory.locations);setBalances(inventory.balances)
   if(!fullHistoryLoadedRef.current&&loadedItemHistoryRef.current.size){const retainedIds=new Set(loadedItemHistoryRef.current);setTransactions(current=>{const merged=new Map(history.map(row=>[row.id,row]));current.filter(row=>retainedIds.has(row.itemId)).forEach(row=>merged.set(row.id,row));return [...merged.values()].sort((a,b)=>b.createdAt.localeCompare(a.createdAt))})}else setTransactions(history)
   setError(null)
   hasDataRef.current=true
   if(userRole)writeStockSnapshot(sessionStorage,userId,userRole,{items:inventory.items,categories:inventory.categories,locations:inventory.locations,balances:inventory.balances,transactions:snapshot.history})
  }catch(problem){
   if(token!==loadTokenRef.current)return
   if(showLoading||!hasDataRef.current)setError(problem instanceof Error?problem.message:'ไม่สามารถโหลดข้อมูลจากระบบได้')
   throw problem
  }finally{reportTiming('stock bootstrap',startedAt);if(showLoading&&token===loadTokenRef.current)setLoading(false)}
 },[localMode,userId,userRole,userName])

 const loadHistory=useCallback(async(itemId?:string)=>{
  if(localMode||!userId||userRole==='issuer')return
  if(!itemId&&fullHistoryLoadedRef.current)return
  if(itemId&&(fullHistoryLoadedRef.current||loadedItemHistoryRef.current.has(itemId)))return
  const startedAt=beginTiming();setHistoryLoading(true)
  try{
   const rows=await inventoryService.loadHistory(userRole,userName,itemId)
   if(itemId){loadedItemHistoryRef.current.add(itemId);setTransactions(current=>{const merged=new Map(current.map(row=>[row.id,row]));rows.forEach(row=>merged.set(row.id,row));return [...merged.values()].sort((a,b)=>b.createdAt.localeCompare(a.createdAt))})}
   else{fullHistoryLoadedRef.current=true;setTransactions(rows)}
  }finally{reportTiming(itemId?'item history':'full stock history',startedAt);setHistoryLoading(false)}
 },[localMode,userId,userRole,userName])

 useLayoutEffect(()=>{
  if(localMode){setLoading(false);return}
  if(!userId||!userRole){loadTokenRef.current+=1;hasDataRef.current=false;fullHistoryLoadedRef.current=false;loadedItemHistoryRef.current.clear();setItems([]);setCategories([]);setLocations([]);setTransactions([]);setBalances({});setError(null);setLoading(false);return}
  const cached=readStockSnapshot(sessionStorage,userId,userRole)
  if(cached){setItems(cached.items);setCategories(cached.categories);setLocations(cached.locations);setTransactions(cached.transactions);setBalances(cached.balances);setError(null);setLoading(false);hasDataRef.current=true;void reloadData(false).catch(()=>undefined)}
  else{hasDataRef.current=false;void reloadData(true).catch(()=>undefined)}
 },[localMode,userId,userRole,reloadData])
 useEffect(()=>{if(localMode||!userId)return;const refresh=()=>{if(document.visibilityState!=='visible'||Date.now()-lastLoadAtRef.current<60000)return;void reloadData(false).catch(()=>undefined)};window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);const timer=window.setInterval(refresh,120000);return()=>{window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);window.clearInterval(timer)}},[localMode,userId,reloadData])
 useEffect(()=>{if(!localMode||loading)return;localStorage.setItem(KEYS.items,JSON.stringify(items));localStorage.setItem(KEYS.categories,JSON.stringify(categories));localStorage.setItem(KEYS.locations,JSON.stringify(locations));localStorage.setItem(KEYS.transactions,JSON.stringify(transactions));localStorage.setItem(KEYS.balances,JSON.stringify(balances))},[items,categories,locations,transactions,balances,localMode,loading])

 const syncAfterWrite=async()=>{if(!localMode)await reloadData(false).catch(()=>undefined)}
 const getLocationQuantity=(itemId:string,locationId:string)=>balances[itemId]?.[locationId]??0
 const makeTransaction=(data:Omit<StockTransaction,'id'|'user'|'createdAt'>):StockTransaction=>({...data,id:`TX-${Date.now()}-${crypto.randomUUID().slice(0,6)}`,user:user?.name??'ผู้ใช้งาน',createdAt:new Date().toISOString()})

 const value=useMemo<Store>(()=>({items,categories,locations,transactions,balances,loading,historyLoading,error,reload:()=>reloadData(true),loadHistory,getLocationQuantity,
  addItem:async input=>{const item=await inventoryService.createItem(input);if(localMode){setItems(current=>[item,...current]);setBalances(current=>({...current,[item.id]:{[item.locationId]:0}}))}else await syncAfterWrite();record({action:'CREATE',entity:'item',entityId:item.id,title:item.name,detail:`เพิ่มสินค้า SKU ${item.sku}`})},
  importItems:async inputs=>{if(!inputs.length)return 0;if(!localMode){const count=await inventoryService.bulkCreate(inputs);await syncAfterWrite();return count}for(const input of inputs){const item=await inventoryService.createItem(input);setItems(current=>[item,...current]);setBalances(current=>({...current,[item.id]:{[item.locationId]:0}}))}return inputs.length},
  updateItem:async item=>{await inventoryService.updateItem(item);if(localMode){setItems(current=>current.map(row=>row.id===item.id?item:row));setBalances(current=>current[item.id]?current:{...current,[item.id]:{[item.locationId]:item.quantity}})}else await syncAfterWrite();record({action:'UPDATE',entity:'item',entityId:item.id,title:item.name,detail:`แก้ไขข้อมูลสินค้า SKU ${item.sku}`})},
  deleteItem:async id=>{const item=items.find(row=>row.id===id);await inventoryService.deleteItem(id);if(localMode)setItems(current=>current.map(row=>row.id===id?{...row,isActive:false}:row));else await syncAfterWrite();record({action:'UPDATE',entity:'item',entityId:id,title:item?.name??id,detail:`ปิดใช้งานสินค้า SKU ${item?.sku??'-'}`})},
  applyStock:async(type,input)=>{const current=items.find(item=>item.id===input.itemId);if(!current)throw new Error('ไม่พบรายการสินค้า');const locationBefore=getLocationQuantity(current.id,input.locationId);if(type==='OUT'&&input.quantity>locationBefore)throw new Error('จำนวนที่เบิกมากกว่าสต็อกในตำแหน่งนี้');await stockService.apply(type,input);if(!localMode){await syncAfterWrite()}else{const locationAfter=type==='IN'?locationBefore+input.quantity:locationBefore-input.quantity;const totalAfter=type==='IN'?current.quantity+input.quantity:current.quantity-input.quantity;const oldAverage=current.averageUnitCost??0;const unitCost=type==='IN'?(input.totalPurchaseCost??0)/input.quantity:oldAverage;const totalCost=type==='IN'?(input.totalPurchaseCost??0):oldAverage*input.quantity;const averageUnitCost=type==='IN'?nextAverageUnitCost(current.quantity,oldAverage,input.quantity,input.totalPurchaseCost??0):oldAverage;setBalances(rows=>({...rows,[current.id]:{...rows[current.id],[input.locationId]:locationAfter}}));setItems(rows=>rows.map(item=>item.id===current.id?{...item,quantity:totalAfter,averageUnitCost}:item));setTransactions(rows=>[makeTransaction({itemId:current.id,locationId:input.locationId,type,quantity:input.quantity,before:locationBefore,after:locationAfter,employeeName:input.employeeName,department:input.department,approvedBy:input.approvedBy,purpose:input.purpose,note:input.note||undefined,unitCost,totalCost}),...rows])}record({action:type==='IN'?'STOCK_IN':'STOCK_OUT',entity:'stock',entityId:current.id,title:current.name,detail:`${type==='IN'?'รับเข้า':'เบิกออก'} ${input.quantity} ${current.unit}`})},
  adjustStock:async input=>{const current=items.find(item=>item.id===input.itemId);if(!current)throw new Error('ไม่พบรายการสินค้า');const before=getLocationQuantity(current.id,input.locationId);if(input.countedQuantity===before)throw new Error('ยอดตรวจนับเท่ากับยอดในระบบ ไม่จำเป็นต้องปรับ');await stockService.adjust(input);if(!localMode)await syncAfterWrite();else{const difference=input.countedQuantity-before;setBalances(rows=>({...rows,[current.id]:{...rows[current.id],[input.locationId]:input.countedQuantity}}));setItems(rows=>rows.map(item=>item.id===current.id?{...item,quantity:item.quantity+difference}:item));setTransactions(rows=>[makeTransaction({itemId:current.id,locationId:input.locationId,type:'ADJUST',quantity:Math.abs(difference),before,after:input.countedQuantity,referenceNo:input.referenceNo,purpose:input.reason,note:input.note}),...rows])}record({action:'STOCK_ADJUST',entity:'stock',entityId:current.id,title:current.name,detail:`ปรับยอดจาก ${before} เป็น ${input.countedQuantity} ${current.unit}`})},
  transferStock:async input=>{const current=items.find(item=>item.id===input.itemId);if(!current)throw new Error('ไม่พบรายการสินค้า');if(input.sourceLocationId===input.destinationLocationId)throw new Error('ตำแหน่งต้นทางและปลายทางต้องไม่ซ้ำกัน');const sourceBefore=getLocationQuantity(current.id,input.sourceLocationId);const destinationBefore=getLocationQuantity(current.id,input.destinationLocationId);if(input.quantity<=0||input.quantity>sourceBefore)throw new Error('จำนวนโอนมากกว่ายอดคงเหลือที่ต้นทาง');await stockService.transfer(input);const sourceName=locations.find(location=>location.id===input.sourceLocationId)?.name??'-';const destinationName=locations.find(location=>location.id===input.destinationLocationId)?.name??'-';if(!localMode)await syncAfterWrite();else{setBalances(rows=>({...rows,[current.id]:{...rows[current.id],[input.sourceLocationId]:sourceBefore-input.quantity,[input.destinationLocationId]:destinationBefore+input.quantity}}));setTransactions(rows=>[makeTransaction({itemId:current.id,locationId:input.sourceLocationId,destinationLocationId:input.destinationLocationId,type:'TRANSFER',quantity:input.quantity,before:sourceBefore,after:sourceBefore-input.quantity,referenceNo:input.referenceNo,purpose:input.reason,note:[`โอนจาก ${sourceName} ไป ${destinationName}`,input.note??''].filter(Boolean).join(' | ')}),...rows])}record({action:'STOCK_TRANSFER',entity:'stock',entityId:current.id,title:current.name,detail:`โอน ${input.quantity} ${current.unit} จาก ${sourceName} ไป ${destinationName}`})},
  addCategory:async(name,description)=>{const category=await inventoryService.createCategory(name,description);if(localMode)setCategories(rows=>[...rows,category]);else await syncAfterWrite();record({action:'CREATE',entity:'category',entityId:category.id,title:name,detail:'เพิ่มหมวดหมู่สินค้า'})},
  updateCategory:async category=>{const old=categories.find(row=>row.id===category.id);await inventoryService.updateCategory(category);if(localMode)setCategories(rows=>rows.map(row=>row.id===category.id?category:row));else await syncAfterWrite();record({action:'UPDATE',entity:'category',entityId:category.id,title:category.name,detail:`เปลี่ยนชื่อหมวดหมู่จาก ${old?.name??'-'} เป็น ${category.name}`})},
  deleteCategory:async id=>{if(items.some(item=>item.categoryId===id))throw new Error('ไม่สามารถลบหมวดหมู่ที่ยังมีสินค้าใช้งานอยู่');const category=categories.find(row=>row.id===id);await inventoryService.deleteCategory(id);if(localMode)setCategories(rows=>rows.filter(row=>row.id!==id));else await syncAfterWrite();record({action:'DELETE',entity:'category',entityId:id,title:category?.name??id,detail:'ลบหมวดหมู่สินค้า'})},
  addLocation:async(name,description)=>{const location=await inventoryService.createLocation(name,description);if(localMode)setLocations(rows=>[...rows,location]);else await syncAfterWrite();record({action:'CREATE',entity:'location',entityId:location.id,title:name,detail:'เพิ่มตำแหน่งจัดเก็บ'})},
  deleteLocation:async id=>{if(Object.values(balances).some(row=>(row[id]??0)>0))throw new Error('ไม่สามารถลบตำแหน่งที่ยังมีสต็อกคงเหลือ');const location=locations.find(row=>row.id===id);await inventoryService.deleteLocation(id);if(localMode)setLocations(rows=>rows.filter(row=>row.id!==id));else await syncAfterWrite();record({action:'DELETE',entity:'location',entityId:id,title:location?.name??id,detail:'ลบตำแหน่งจัดเก็บ'})},
 }),[items,categories,locations,transactions,balances,loading,historyLoading,error,user,record,localMode,reloadData,loadHistory])
 return <Context.Provider value={value}>{children}</Context.Provider>
}
export const useStock=()=>{const value=useContext(Context);if(!value)throw new Error('StockProvider missing');return value}
