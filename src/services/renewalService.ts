import { supabase } from '../lib/supabase'
import type { RenewalActionInput, RenewalHistoryEntry, RenewalItem } from '../types'

const toItem=(row:any):RenewalItem=>({
 id:String(row.id),name:String(row.name),category:String(row.category),expiryDate:String(row.expiry_date),remindDays:Number(row.remind_days),
 cycleCount:Number(row.cycle_count),cycleUnit:row.cycle_unit,owner:String(row.owner),cost:Number(row.estimated_cost??0),
 documentUrl:row.document_url??undefined,note:String(row.note??''),isActive:Boolean(row.is_active),
 lastRenewedAt:row.last_renewed_at??undefined,updatedAt:String(row.updated_at),
})

export const renewalService={
 async load():Promise<{items:RenewalItem[];history:RenewalHistoryEntry[]}>{
  if(!supabase)return {items:[],history:[]}
  const [{data:rows,error},{data:historyRows,error:historyError},{data:profiles,error:profileError}]=await Promise.all([
   supabase.from('renewals').select('*').order('expiry_date'),
   supabase.from('renewal_history').select('*').order('renewed_at',{ascending:false}),
   supabase.from('profiles').select('id,full_name'),
  ])
  if(error||historyError||profileError)throw error??historyError??profileError
  const names=new Map((profiles??[]).map((row:any)=>[String(row.id),String(row.full_name)]))
  const items=(rows??[]).map(toItem);const itemNames=new Map(items.map(item=>[item.id,item.name]))
  return {items,history:(historyRows??[]).map((row:any)=>({id:String(row.id),renewalId:String(row.renewal_id),itemName:itemNames.get(String(row.renewal_id))??'-',previousExpiryDate:String(row.previous_expiry_date),newExpiryDate:String(row.new_expiry_date),cost:Number(row.cost??0),documentUrl:row.evidence_url??undefined,renewedBy:names.get(String(row.renewed_by))??'ผู้ใช้งาน',renewedAt:String(row.renewed_at)}))}
 },
 async create(item:Omit<RenewalItem,'id'|'updatedAt'>){if(!supabase)throw new Error('Supabase is not configured');const {error}=await supabase.from('renewals').insert({name:item.name,category:item.category,expiry_date:item.expiryDate,remind_days:item.remindDays,cycle_count:item.cycleCount,cycle_unit:item.cycleUnit,owner:item.owner,estimated_cost:item.cost??0,document_url:item.documentUrl||null,note:item.note,is_active:item.isActive});if(error)throw error},
 async update(item:RenewalItem){if(!supabase)throw new Error('Supabase is not configured');const {error}=await supabase.from('renewals').update({name:item.name,category:item.category,expiry_date:item.expiryDate,remind_days:item.remindDays,cycle_count:item.cycleCount,cycle_unit:item.cycleUnit,owner:item.owner,estimated_cost:item.cost??0,document_url:item.documentUrl||null,note:item.note,is_active:item.isActive}).eq('id',item.id);if(error)throw error},
 async remove(id:string){if(!supabase)throw new Error('Supabase is not configured');const {error}=await supabase.from('renewals').delete().eq('id',id);if(error)throw error},
 async renew(item:RenewalItem,input:RenewalActionInput){if(!supabase)throw new Error('Supabase is not configured');const {error}=await supabase.rpc('renew_renewal_v2',{p_renewal_id:item.id,p_new_expiry_date:input.newExpiryDate,p_cost:input.cost,p_evidence_url:input.documentUrl||null,p_note:input.note||null});if(error)throw error},
}
