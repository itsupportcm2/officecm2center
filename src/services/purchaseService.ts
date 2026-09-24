import { supabase } from '../lib/supabase'
import type { Item, PurchaseRequest } from '../types'

export const purchaseService={
 async load():Promise<PurchaseRequest[]>{
  if(!supabase)return []
  const [{data:requests,error},{data:lines,error:lineError},{data:items,error:itemError},{data:profiles,error:profileError}]=await Promise.all([
   supabase.from('purchase_requests').select('*').order('created_at',{ascending:false}),
   supabase.from('purchase_request_lines').select('*'),supabase.from('items').select('id,sku,name,unit'),supabase.from('profiles').select('id,full_name'),
  ])
  if(error||lineError||itemError||profileError)throw error??lineError??itemError??profileError
  const itemMap=new Map((items??[]).map((row:any)=>[String(row.id),row]));const names=new Map((profiles??[]).map((row:any)=>[String(row.id),String(row.full_name)]))
  return (requests??[]).map((row:any)=>({id:String(row.id),requestNo:String(row.request_no),status:row.status,note:String(row.note??''),requestedBy:names.get(String(row.requested_by))??'ผู้ใช้งาน',createdAt:String(row.created_at),updatedAt:String(row.updated_at),lines:(lines??[]).filter((line:any)=>line.request_id===row.id).map((line:any)=>{const item=itemMap.get(String(line.item_id));return {itemId:String(line.item_id),sku:String(item?.sku??'-'),name:String(item?.name??'-'),quantity:Number(line.quantity),unit:String(line.unit??item?.unit??'-')}})}))
 },
 async create(items:Item[]){if(!supabase)throw new Error('Supabase is not configured');const {error}=await supabase.rpc('create_purchase_request',{p_note:'สร้างจากรายการสินค้าใกล้หมด',p_lines:items.map(item=>({item_id:item.id,quantity:Math.max(item.minStock*2-item.quantity,1)}))});if(error)throw error},
 async updateStatus(id:string,status:PurchaseRequest['status']){if(!supabase)throw new Error('Supabase is not configured');const {error}=await supabase.from('purchase_requests').update({status}).eq('id',id);if(error)throw error},
 async updateLine(requestId:string,itemId:string,quantity:number){if(!supabase)throw new Error('Supabase is not configured');const {error}=await supabase.from('purchase_request_lines').update({quantity:Math.max(1,quantity)}).eq('request_id',requestId).eq('item_id',itemId);if(error)throw error},
 async updateNote(id:string,note:string){if(!supabase)throw new Error('Supabase is not configured');const {error}=await supabase.from('purchase_requests').update({note}).eq('id',id);if(error)throw error},
}
