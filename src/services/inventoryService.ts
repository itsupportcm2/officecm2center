import { categories as seedCategories, items as seedItems, locations as seedLocations } from '../data/mockData'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type { Category, Item, Location } from '../types'

export interface InventoryData { items: Item[]; categories: Category[]; locations: Location[] }

const toItem = (row: Record<string, unknown>): Item => ({
  id: String(row.id), sku: String(row.sku), name: String(row.name), description: String(row.description ?? ''),
  categoryId: String(row.category_id), unit: String(row.unit), minStock: Number(row.min_stock), barcode: String(row.barcode ?? ''),
  imageUrl: row.image_url ? String(row.image_url) : undefined, isActive: Boolean(row.is_active),
  locationId: String(row.location_id), quantity: Number(row.quantity), createdAt: String(row.created_at),
})

export const inventoryService = {
  async load(): Promise<InventoryData> {
    if (!isSupabaseConfigured || !supabase) return { items: seedItems, categories: seedCategories, locations: seedLocations }
    const [{ data: itemRows, error: itemError }, { data: categories, error: catError }, { data: locations, error: locError }] = await Promise.all([
      supabase.from('inventory_overview').select('*'), supabase.from('categories').select('*').order('name'), supabase.from('locations').select('*').order('name'),
    ])
    if (itemError || catError || locError) throw itemError ?? catError ?? locError
    return {
      items: (itemRows ?? []).map(toItem),
      categories: (categories ?? []).map(r => ({ id:r.id, name:r.name, description:r.description ?? '' })),
      locations: (locations ?? []).map(r => ({ id:r.id, name:r.name, description:r.description ?? '' })),
    }
  },
}
