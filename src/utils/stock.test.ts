import { describe, expect, it } from 'vitest'
import { buildLocationBalances, nextAverageUnitCost } from './stock'

describe('stock calculations',()=>{
  it('keeps quantities separated by location',()=>{
    const balances=buildLocationBalances([
      {item_id:'item-1',location_id:'A',quantity:'4'},
      {item_id:'item-1',location_id:'B',quantity:6},
      {item_id:'item-2',location_id:'A',quantity:2},
    ])
    expect(balances).toEqual({'item-1':{A:4,B:6},'item-2':{A:2}})
  })

  it('calculates weighted average cost',()=>{
    expect(nextAverageUnitCost(10,20,5,150)).toBe(350/15)
  })
})
