import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { categories as initialCategories, items as initialItems, locations as initialLocations, transactions as initialTransactions } from '../data/mockData'
import { inventoryService } from '../services/inventoryService'
import { stockService } from '../services/stockService'
import type { Category, Item, Location, StockChangeInput, StockTransaction, TransactionType } from '../types'

interface Store {
  items: Item[]; categories: Category[]; locations: Location[]; transactions: StockTransaction[]; loading: boolean;
  addItem: (item: Omit<Item,'id'|'createdAt'|'quantity'>) => void; updateItem: (item: Item) => void; deleteItem: (id: string) => void;
  applyStock: (type: Extract<TransactionType,'IN'|'OUT'>, input: StockChangeInput) => Promise<void>;
  addCategory: (name:string, description:string) => void; deleteCategory:(id:string)=>void;
  addLocation: (name:string, description:string) => void; deleteLocation:(id:string)=>void;
}
const Context = createContext<Store | null>(null)
export const StockProvider = ({ children }: { children: ReactNode }) => {
  const [items,setItems]=useState(initialItems); const [categories,setCategories]=useState(initialCategories)
  const [locations,setLocations]=useState(initialLocations); const [transactions,setTransactions]=useState(initialTransactions)
  const [loading,setLoading]=useState(true)
  useEffect(()=>{ inventoryService.load().then(d=>{setItems(d.items);setCategories(d.categories);setLocations(d.locations)}).finally(()=>setLoading(false)) },[])
  const value=useMemo<Store>(()=>({ items,categories,locations,transactions,loading,
    addItem:(item)=>setItems(v=>[{...item,id:crypto.randomUUID(),createdAt:new Date().toISOString(),quantity:0},...v]),
    updateItem:(item)=>setItems(v=>v.map(x=>x.id===item.id?item:x)), deleteItem:(id)=>setItems(v=>v.filter(x=>x.id!==id)),
    applyStock:async(type,input)=>{ const current=items.find(i=>i.id===input.itemId); if(!current) throw new Error('ไม่พบรายการสินค้า'); if(type==='OUT'&&input.quantity>current.quantity) throw new Error('จำนวนที่เบิกมากกว่าสต็อกคงเหลือ'); await stockService.apply(type,input); const after=type==='IN'?current.quantity+input.quantity:current.quantity-input.quantity; setItems(v=>v.map(i=>i.id===current.id?{...i,quantity:after}:i)); setTransactions(v=>[{ id:`TX-${Date.now()}`, itemId:current.id, locationId:input.locationId, type, quantity:input.quantity, before:current.quantity, after, referenceNo:input.referenceNo, employeeName:input.employeeName, department:input.department, purpose:input.purpose, note:input.note, user:'ณัฐพล', createdAt:new Date().toISOString() },...v]) },
    addCategory:(name,description)=>setCategories(v=>[...v,{id:crypto.randomUUID(),name,description}]), deleteCategory:id=>setCategories(v=>v.filter(x=>x.id!==id)),
    addLocation:(name,description)=>setLocations(v=>[...v,{id:crypto.randomUUID(),name,description}]), deleteLocation:id=>setLocations(v=>v.filter(x=>x.id!==id)),
  }),[items,categories,locations,transactions,loading])
  return <Context.Provider value={value}>{children}</Context.Provider>
}
export const useStock=()=>{const v=useContext(Context);if(!v)throw new Error('StockProvider missing');return v}
