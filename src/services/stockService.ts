import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type { StockAdjustmentInput, StockChangeInput, StockTransaction, StockTransferInput, TransactionType } from '../types'

export const stockService = {
  async apply(type: Extract<TransactionType, 'IN' | 'OUT'>, input: StockChangeInput): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return
    const args = type === 'IN'
      ? { p_item_id:input.itemId, p_location_id:input.locationId, p_quantity:input.quantity, p_total_cost:input.totalPurchaseCost ?? 0, p_note:input.note ?? null }
      : { p_item_id:input.itemId, p_location_id:input.locationId, p_quantity:input.quantity, p_employee_name:input.employeeName ?? '', p_department:input.department ?? '', p_approved_by:input.approvedBy ?? '', p_note:input.note ?? null }
    const { error } = await supabase.rpc(type === 'IN' ? 'stock_in_with_cost' : 'stock_out_with_cost', args)
    if (error) throw error
  },
  async adjust(input:StockAdjustmentInput):Promise<void>{
    if(!isSupabaseConfigured||!supabase)return
    const {error}=await supabase.rpc('stock_adjust',{p_item_id:input.itemId,p_location_id:input.locationId,p_counted_quantity:input.countedQuantity,p_reference_no:input.referenceNo,p_reason:input.reason,p_note:input.note??null})
    if(error)throw error
  },
  async transfer(input:StockTransferInput):Promise<void>{
    if(!isSupabaseConfigured||!supabase)return
    const {error}=await supabase.rpc('stock_transfer',{p_item_id:input.itemId,p_source_location_id:input.sourceLocationId,p_destination_location_id:input.destinationLocationId,p_quantity:input.quantity,p_reference_no:input.referenceNo,p_reason:input.reason,p_note:input.note??null})
    if(error)throw error
  },
  async history(): Promise<StockTransaction[]> {
    if (!isSupabaseConfigured || !supabase) return []
    const [{data,error},{data:profiles,error:profileError}] = await Promise.all([supabase.from('stock_transactions').select('*').order('created_at',{ascending:false}),supabase.from('profiles').select('id,full_name')])
    if (error || profileError) throw error ?? profileError
    const names=new Map((profiles??[]).map((row:any)=>[String(row.id),String(row.full_name)]))
    return (data??[]).map((row:any)=>({
      id:String(row.id),itemId:String(row.item_id),locationId:String(row.location_id),destinationLocationId:row.destination_location_id?String(row.destination_location_id):undefined,type:row.transaction_type as TransactionType,
      quantity:Number(row.quantity),before:Number(row.quantity_before),after:Number(row.quantity_after),referenceNo:row.reference_no??undefined,
      employeeName:row.employee_name??undefined,department:row.department??undefined,purpose:row.purpose??undefined,note:row.note??undefined,approvedBy:row.approved_by??undefined,
      unitCost:row.unit_cost==null?undefined:Number(row.unit_cost),totalCost:row.total_cost==null?undefined:Number(row.total_cost),
      user:names.get(String(row.created_by))??'ผู้ใช้งาน',createdAt:String(row.created_at),
    }))
  },
}
