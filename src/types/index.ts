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
  before: number; after: number; referenceNo?: string; employeeName?: string; department?: string;
  purpose?: string; note?: string; user: string; createdAt: string;
}
export interface StockChangeInput {
  itemId: string; locationId: string; quantity: number; referenceNo?: string; supplier?: string;
  employeeName?: string; department?: string; purpose?: string; note?: string;
}
