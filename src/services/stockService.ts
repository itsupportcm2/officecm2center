import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type { StockChangeInput, StockTransaction, TransactionType } from '../types'

export const stockService = {
  async apply(type: Extract<TransactionType, 'IN' | 'OUT'>, input: StockChangeInput): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return
    const { error } = await supabase.rpc(type === 'IN' ? 'stock_in' : 'stock_out', {
      p_item_id: input.itemId, p_location_id: input.locationId, p_quantity: input.quantity,
      p_reference_no: input.referenceNo ?? null, p_employee_name: input.employeeName ?? null,
      p_department: input.department ?? null, p_purpose: input.purpose ?? null, p_note: input.note ?? null,
    })
    if (error) throw error
  },
  async history(): Promise<StockTransaction[]> { return [] },
}
