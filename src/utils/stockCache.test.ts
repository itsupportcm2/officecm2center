import { describe, expect, it } from 'vitest'
import { readStockSnapshot, writeStockSnapshot, type StockSnapshot } from './stockCache'

const storage=()=>{
  const values=new Map<string,string>()
  return {getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value),removeItem:(key:string)=>values.delete(key)}
}
const snapshot:StockSnapshot={items:[],categories:[],locations:[],transactions:[],balances:{}}

describe('stock session cache',()=>{
  it('keeps snapshots separated by user',()=>{
    const target=storage();writeStockSnapshot(target,'user-a','staff',snapshot)
    expect(readStockSnapshot(target,'user-a','staff')).toEqual(snapshot)
    expect(readStockSnapshot(target,'user-b','staff')).toBeNull()
  })

  it('keeps snapshots separated by role',()=>{
    const target=storage();writeStockSnapshot(target,'user-a','staff',snapshot)
    expect(readStockSnapshot(target,'user-a','issuer')).toBeNull()
  })

  it('discards malformed cached data',()=>{
    const target=storage();target.setItem('cm-office-online-snapshot-v2:user-a:staff','{"userId":"user-a","role":"staff"}')
    expect(readStockSnapshot(target,'user-a','staff')).toBeNull()
  })
})
