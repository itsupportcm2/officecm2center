import { categories as seedCategories, items as seedItems, locations as seedLocations } from '../data/mockData'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type { Category, Item, Location, Role } from '../types'
import { buildLocationBalances, type LocationBalances } from '../utils/stock'

export interface InventoryData { items: Item[]; categories: Category[]; locations: Location[]; balances:LocationBalances }

const toItem = (row: Record<string, unknown>): Item => ({
  id: String(row.id), sku: String(row.sku), name: String(row.name), description: String(row.description ?? ''),
  categoryId: String(row.category_id), unit: String(row.unit), minStock: Number(row.min_stock), barcode: String(row.barcode ?? ''),
  imageUrl: row.image_url ? String(row.image_url) : undefined, isActive: Boolean(row.is_active),
  locationId: row.location_id ? String(row.location_id) : '', quantity: Number(row.quantity), averageUnitCost: Number(row.average_unit_cost ?? 0), createdAt: String(row.created_at),
})

const loadAllBalances=async()=>{
  if(!supabase)return []
  const rows:Array<{item_id:string;location_id:string;quantity:number|string}>=[];const pageSize=1000;let from=0
  while(true){const {data,error}=await supabase.from('stock_balances').select('item_id,location_id,quantity').range(from,from+pageSize-1);if(error)throw error;rows.push(...(data??[]));if((data?.length??0)<pageSize)break;from+=pageSize}
  return rows
}
const loadAllItems=async()=>{
  if(!supabase)return []
  const rows:Record<string,unknown>[]=[];const pageSize=1000;let from=0
  while(true){const {data,error}=await supabase.from('inventory_overview').select('*').order('created_at',{ascending:false}).range(from,from+pageSize-1);if(error)throw error;rows.push(...(data??[]));if((data?.length??0)<pageSize)break;from+=pageSize}
  return rows
}

export const inventoryService = {
  async load(role?:Role): Promise<InventoryData> {
    if (!isSupabaseConfigured || !supabase) return {items:seedItems,categories:seedCategories,locations:seedLocations,balances:Object.fromEntries(seedItems.map(item=>[item.id,{[item.locationId]:item.quantity}]))}
    if(role==='issuer'){
      const {data,error}=await supabase.rpc('get_issue_catalog')
      if(error)throw error
      const payload=(data??{}) as {items?:Record<string,unknown>[];locations?:Record<string,unknown>[];balances?:Array<{item_id:string;location_id:string;quantity:number|string}>}
      return {
        items:(payload.items??[]).map(row=>({
          id:String(row.id),sku:String(row.sku),name:String(row.name),description:'',categoryId:'',unit:String(row.unit),minStock:0,
          barcode:String(row.barcode??''),isActive:true,locationId:row.primary_location_id?String(row.primary_location_id):'',
          quantity:Number(row.quantity??0),createdAt:String(row.created_at),
        })),
        categories:[],
        locations:(payload.locations??[]).map(row=>({id:String(row.id),name:String(row.name),description:String(row.description??'')})),
        balances:buildLocationBalances(payload.balances??[]),
      }
    }
    const [itemRows, { data: categories, error: catError }, { data: locations, error: locError }, balanceRows] = await Promise.all([
      loadAllItems(), supabase.from('categories').select('*').order('name'), supabase.from('locations').select('*').order('name'),loadAllBalances(),
    ])
    if (catError || locError) throw catError ?? locError
    return {
      items: itemRows.map(toItem),
      categories: (categories ?? []).map(r => ({ id:r.id, name:r.name, description:r.description ?? '' })),
      locations: (locations ?? []).map(r => ({ id:r.id, name:r.name, description:r.description ?? '' })),
      balances:buildLocationBalances(balanceRows??[]),
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
  async updateItem(item:Item):Promise<void>{if(!supabase)return;const {error}=await supabase.rpc('update_inventory_item',{p_item_id:item.id,p_sku:item.sku,p_name:item.name,p_description:item.description,p_category_id:item.categoryId,p_unit:item.unit,p_min_stock:item.minStock,p_barcode:item.barcode||null,p_image_url:item.imageUrl||null,p_is_active:item.isActive,p_location_id:item.locationId});if(error)throw error},
  async deleteItem(id:string):Promise<void>{if(!supabase)return;const {error}=await supabase.rpc('archive_inventory_item',{p_item_id:id});if(error)throw error},
  async bulkCreate(inputs:Array<Omit<Item,'id'|'createdAt'|'quantity'>>):Promise<number>{if(!supabase)return inputs.length;const {data,error}=await supabase.rpc('bulk_create_inventory_items',{p_items:inputs.map(input=>({sku:input.sku,name:input.name,description:input.description,category_id:input.categoryId,unit:input.unit,min_stock:input.minStock,barcode:input.barcode||null,image_url:input.imageUrl||null,is_active:input.isActive,location_id:input.locationId}))});if(error)throw error;return Number(data??0)},
  async createCategory(name:string,description:string):Promise<Category>{if(!supabase)return{id:crypto.randomUUID(),name,description};const {data,error}=await supabase.from('categories').insert({name,description}).select('*').single();if(error)throw error;return{id:data.id,name:data.name,description:data.description??''}},
  async updateCategory(category:Category):Promise<void>{if(!supabase)return;const {error}=await supabase.rpc('update_inventory_category',{p_category_id:category.id,p_name:category.name,p_description:category.description});if(error)throw error},
  async deleteCategory(id:string):Promise<void>{if(!supabase)return;const {error}=await supabase.from('categories').delete().eq('id',id);if(error)throw error},
  async createLocation(name:string,description:string):Promise<Location>{if(!supabase)return{id:crypto.randomUUID(),name,description};const {data,error}=await supabase.from('locations').insert({name,description}).select('*').single();if(error)throw error;return{id:data.id,name:data.name,description:data.description??''}},
  async deleteLocation(id:string):Promise<void>{if(!supabase)return;const {error}=await supabase.from('locations').delete().eq('id',id);if(error)throw error},
}
