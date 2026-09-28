import { describe, expect, it } from 'vitest'
import { readStockSnapshot, writeStockSnapshot, type StockSnapshot } from './stockCache'

const storage=()=>{
  const values=new Map<string,string>()
  return {getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value),removeItem:(key:string)=>values.delete(key)}
}
const snapshot:StockSnapshot={items:[],categories:[],locations:[],transactions:[],balances:{}}

describe('stock session cache',()=>{
  it('keeps snapshots separated by user',()=>{
    const target=storage();writeStockSnapshot(target,'user-a',snapshot)
    expect(readStockSnapshot(target,'user-a')).toEqual(snapshot)
    expect(readStockSnapshot(target,'user-b')).toBeNull()
  })

  it('discards malformed cached data',()=>{
    const target=storage();target.setItem('cm-office-online-snapshot-v1:user-a','{"userId":"user-a"}')
    expect(readStockSnapshot(target,'user-a')).toBeNull()
  })
})
