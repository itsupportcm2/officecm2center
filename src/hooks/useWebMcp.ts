import { useEffect } from 'react'
import type { Item } from '../types'

type Tool = { name:string; title:string; description:string; inputSchema:object; annotations:Record<string,boolean>; execute:(input:unknown)=>unknown }
declare global { interface Document { modelContext?: { registerTool:(tool:Tool,options?:{signal:AbortSignal})=>void|Promise<void> } } }

export function useWebMcp(items: Item[]) {
  useEffect(() => {
    const context=document.modelContext;if(!context?.registerTool)return
    const lifecycle=new AbortController()
    const register=(tool:Tool)=>{try{void Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>undefined)}catch{return}}
    register({
      name:'list_low_stock', title:'ดูสินค้าใกล้หมด', description:'แสดงรายการสินค้าที่หมดหรือมีจำนวนไม่เกินสต็อกขั้นต่ำ',
      inputSchema:{type:'object',properties:{},additionalProperties:false}, annotations:{readOnlyHint:true,untrustedContentHint:false},
      execute:()=>items.filter(i=>i.quantity<=i.minStock).map(i=>({id:i.id,sku:i.sku,name:i.name,quantity:i.quantity,minStock:i.minStock,unit:i.unit,status:i.quantity===0?'out_of_stock':'low_stock'})),
    })
    register({
      name:'start_stock_transaction', title:'เริ่มทำรายการสต็อก', description:'เปิดแบบฟอร์มรับเข้าหรือเบิกออกสำหรับสินค้าที่เลือก โดยยังไม่บันทึกรายการ',
      inputSchema:{type:'object',properties:{type:{type:'string',enum:['IN','OUT']},itemId:{type:'string'}},required:['type','itemId'],additionalProperties:false}, annotations:{readOnlyHint:false,untrustedContentHint:false},
      execute:(raw)=>{const input=raw as {type?:string;itemId?:string};if(!['IN','OUT'].includes(input.type??'')||!items.some(i=>i.id===input.itemId))throw new Error('ข้อมูลรายการไม่ถูกต้อง');const path=`/${input.type==='IN'?'stock-in':'stock-out'}?item=${encodeURIComponent(input.itemId!)}`;window.history.pushState({},'',path);window.dispatchEvent(new PopStateEvent('popstate'));return{status:'prepared',path}},
    })
    return()=>lifecycle.abort()
  },[items])
}
