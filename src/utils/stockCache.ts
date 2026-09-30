import type { Category, Item, Location, Role, StockTransaction } from '../types'
import type { LocationBalances } from './stock'

const CACHE_PREFIX='cm-office-online-snapshot-v3:'
const MAX_CACHED_TRANSACTIONS=10

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
  role:Role
  savedAt:string
}

const cacheKey=(userId:string,role:Role)=>`${CACHE_PREFIX}${userId}:${role}`

export const readStockSnapshot=(storage:StorageLike,userId:string,role:Role):StockSnapshot|null=>{
  try{
    const key=cacheKey(userId,role)
    const raw=storage.getItem(key)
    if(!raw)return null
    const parsed=JSON.parse(raw) as Partial<StoredSnapshot>
    if(parsed.userId!==userId||parsed.role!==role||!Array.isArray(parsed.items)||!Array.isArray(parsed.categories)||!Array.isArray(parsed.locations)||!Array.isArray(parsed.transactions)||!parsed.balances){
      storage.removeItem(key)
      return null
    }
    return {items:parsed.items,categories:parsed.categories,locations:parsed.locations,transactions:parsed.transactions,balances:parsed.balances}
  }catch{
    storage.removeItem(cacheKey(userId,role))
    return null
  }
}

export const writeStockSnapshot=(storage:StorageLike,userId:string,role:Role,snapshot:StockSnapshot)=>{
  try{
    const stored:StoredSnapshot={...snapshot,transactions:snapshot.transactions.slice(0,MAX_CACHED_TRANSACTIONS),userId,role,savedAt:new Date().toISOString()}
    storage.setItem(cacheKey(userId,role),JSON.stringify(stored))
  }catch{
    storage.removeItem(cacheKey(userId,role))
  }
}
