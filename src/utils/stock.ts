export type LocationBalances=Record<string,Record<string,number>>
export interface BalanceRow { item_id:string; location_id:string; quantity:number|string }

export const buildLocationBalances=(rows:BalanceRow[]):LocationBalances=>rows.reduce<LocationBalances>((result,row)=>{
  const itemId=String(row.item_id)
  const locationId=String(row.location_id)
  result[itemId]??={}
  result[itemId][locationId]=Number(row.quantity)
  return result
},{})

export const nextAverageUnitCost=(currentQuantity:number,currentAverage:number,receivedQuantity:number,totalCost:number)=>{
  const quantityAfter=currentQuantity+receivedQuantity
  if(receivedQuantity<=0||quantityAfter<=0)return currentAverage
  return ((currentQuantity*currentAverage)+totalCost)/quantityAfter
}
