import type { Category, Item, Location, StockTransaction } from '../types'
import type { LocationBalances } from './stock'

const CACHE_PREFIX='cm-office-online-snapshot-v1:'
const MAX_CACHED_TRANSACTIONS=1000

interface StorageLike {
  getItem:(key:string)=>string|null
  setItem:(key:string,value:string)=>void
  removeItem:(key:string)=>void
}

export interface StockSnapshot {
  items:Item[]
  categories:Category[]
  locations:Location[]
  transactions:StockTransaction[]
  balances:LocationBalances
}

interface StoredSnapshot extends StockSnapshot {
  userId:string
  savedAt:string
}

const cacheKey=(userId:string)=>`${CACHE_PREFIX}${userId}`

export const readStockSnapshot=(storage:StorageLike,userId:string):StockSnapshot|null=>{
  try{
    const raw=storage.getItem(cacheKey(userId))
    if(!raw)return null
    const parsed=JSON.parse(raw) as Partial<StoredSnapshot>
    if(parsed.userId!==userId||!Array.isArray(parsed.items)||!Array.isArray(parsed.categories)||!Array.isArray(parsed.locations)||!Array.isArray(parsed.transactions)||!parsed.balances){
      storage.removeItem(cacheKey(userId))
      return null
    }
    return {items:parsed.items,categories:parsed.categories,locations:parsed.locations,transactions:parsed.transactions,balances:parsed.balances}
  }catch{
    storage.removeItem(cacheKey(userId))
    return null
  }
}

export const writeStockSnapshot=(storage:StorageLike,userId:string,snapshot:StockSnapshot)=>{
  try{
    const stored:StoredSnapshot={...snapshot,transactions:snapshot.transactions.slice(0,MAX_CACHED_TRANSACTIONS),userId,savedAt:new Date().toISOString()}
    storage.setItem(cacheKey(userId),JSON.stringify(stored))
  }catch{
    storage.removeItem(cacheKey(userId))
  }
}
