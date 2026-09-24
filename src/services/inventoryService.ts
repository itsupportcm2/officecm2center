import { categories as seedCategories, items as seedItems, locations as seedLocations } from '../data/mockData'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type { Category, Item, Location } from '../types'

export interface InventoryData { items: Item[]; categories: Category[]; locations: Location[] }

const toItem = (row: Record<string, unknown>): Item => ({
  id: String(row.id), sku: String(row.sku), name: String(row.name), description: String(row.description ?? ''),
  categoryId: String(row.category_id), unit: String(row.unit), minStock: Number(row.min_stock), barcode: String(row.barcode ?? ''),
  imageUrl: row.image_url ? String(row.image_url) : undefined, isActive: Boolean(row.is_active),
  locationId: row.location_id ? String(row.location_id) : '', quantity: Number(row.quantity), createdAt: String(row.created_at),
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
  async createItem(input: Omit<Item,'id'|'createdAt'|'quantity'>): Promise<Item> {
    if (!supabase) return {...input,id:crypto.randomUUID(),createdAt:new Date().toISOString(),quantity:0}
    const {data:id,error}=await supabase.rpc('create_inventory_item',{p_sku:input.sku,p_name:input.name,p_description:input.description,p_category_id:input.categoryId,p_unit:input.unit,p_min_stock:input.minStock,p_barcode:input.barcode||null,p_image_url:input.imageUrl||null,p_is_active:input.isActive,p_location_id:input.locationId})
    if(error)throw error
    const {data,error:loadError}=await supabase.from('inventory_overview').select('*').eq('id',id).single()
    if(loadError)throw loadError
    return toItem(data)
  },
  async updateItem(item:Item):Promise<void>{if(!supabase)return;const {error}=await supabase.from('items').update({sku:item.sku,name:item.name,description:item.description,category_id:item.categoryId,unit:item.unit,min_stock:item.minStock,barcode:item.barcode||null,image_url:item.imageUrl||null,is_active:item.isActive,primary_location_id:item.locationId}).eq('id',item.id);if(error)throw error},
  async deleteItem(id:string):Promise<void>{if(!supabase)return;const {error}=await supabase.from('items').delete().eq('id',id);if(error)throw error},
  async createCategory(name:string,description:string):Promise<Category>{if(!supabase)return{id:crypto.randomUUID(),name,description};const {data,error}=await supabase.from('categories').insert({name,description}).select('*').single();if(error)throw error;return{id:data.id,name:data.name,description:data.description??''}},
  async deleteCategory(id:string):Promise<void>{if(!supabase)return;const {error}=await supabase.from('categories').delete().eq('id',id);if(error)throw error},
  async createLocation(name:string,description:string):Promise<Location>{if(!supabase)return{id:crypto.randomUUID(),name,description};const {data,error}=await supabase.from('locations').insert({name,description}).select('*').single();if(error)throw error;return{id:data.id,name:data.name,description:data.description??''}},
  async deleteLocation(id:string):Promise<void>{if(!supabase)return;const {error}=await supabase.from('locations').delete().eq('id',id);if(error)throw error},
}
