export type Role = 'admin' | 'staff' | 'viewer'
export type TransactionType = 'IN' | 'OUT' | 'ADJUST' | 'TRANSFER'

export interface Category { id: string; name: string; description: string }
export interface Location { id: string; name: string; description: string }
export interface Item {
  id: string; sku: string; name: string; description: string; categoryId: string; unit: string;
  minStock: number; barcode: string; imageUrl?: string; isActive: boolean; locationId: string;
  quantity: number; createdAt: string;
}
export interface StockTransaction {
  id: string; itemId: string; locationId: string; type: TransactionType; quantity: number;
  before: number; after: number; referenceNo?: string; employeeName?: string; department?: string; approvedBy?: string;
  purpose?: string; note?: string; destinationLocationId?:string; user: string; createdAt: string;
}
export interface StockAdjustmentInput { itemId:string; locationId:string; countedQuantity:number; referenceNo:string; reason:string; note?:string }
export interface StockTransferInput { itemId:string; sourceLocationId:string; destinationLocationId:string; quantity:number; referenceNo:string; reason:string; note?:string }
export interface StockChangeInput {
  itemId: string; locationId: string; quantity: number; referenceNo?: string; supplier?: string;
  employeeName?: string; department?: string; approvedBy?: string; purpose?: string; note?: string;
}

export interface RenewalItem {
  id: string; name: string; category: string; expiryDate: string; remindDays: number;
  owner: string; note: string; isActive: boolean; cycleCount: number; cycleUnit: 'month'|'year';
  cost?: number; documentUrl?: string; lastRenewedAt?: string; updatedAt: string;
}
export interface RenewalHistoryEntry {
  id:string; renewalId:string; itemName:string; previousExpiryDate:string; newExpiryDate:string;
  cost:number; documentUrl?:string; renewedBy:string; renewedAt:string;
}
export interface RenewalActionInput { newExpiryDate:string; cost:number; documentUrl?:string; note?:string }
export interface PurchaseRequestLine { itemId:string; sku:string; name:string; quantity:number; unit:string }
export interface PurchaseRequest {
  id:string; requestNo:string; status:'DRAFT'|'SUBMITTED'|'ORDERED'|'CANCELLED'; lines:PurchaseRequestLine[];
  note:string; requestedBy:string; createdAt:string; updatedAt:string;
}
