import { supabase } from '../lib/supabase'
import type { IssueRequest, NewIssueRequest } from '../types'

const mapRequest=(row:any):IssueRequest=>({
 id:String(row.id),requestNo:String(row.request_no),status:row.status,
 recipientName:String(row.recipient_name),department:String(row.department),note:String(row.note??''),
 rejectionReason:String(row.rejection_reason??''),requestedBy:String(row.requested_by),requestedByName:String(row.requested_by_name??'ผู้ใช้งาน'),
 reviewedBy:row.reviewed_by?String(row.reviewed_by):undefined,reviewedByName:row.reviewed_by_name?String(row.reviewed_by_name):undefined,
 reviewedAt:row.reviewed_at?String(row.reviewed_at):undefined,createdAt:String(row.created_at),updatedAt:String(row.updated_at),
 lines:(row.lines??[]).map((line:any)=>({
  id:String(line.id),itemId:String(line.item_id),locationId:String(line.location_id),quantity:Number(line.quantity),
  sku:String(line.sku),itemName:String(line.item_name),unit:String(line.unit),locationName:String(line.location_name),
  availableQuantity:Number(line.available_quantity??0),
 })),
})

export const issueRequestService={
 async load():Promise<IssueRequest[]>{if(!supabase)return[];const {data,error}=await supabase.rpc('get_issue_requests');if(error)throw error;return ((data??[]) as any[]).map(mapRequest)},
 async create(input:NewIssueRequest):Promise<void>{if(!supabase)throw new Error('Supabase is not configured');const {error}=await supabase.rpc('create_issue_request',{p_recipient_name:input.recipientName,p_department:input.department,p_note:input.note||null,p_lines:input.lines.map(line=>({item_id:line.itemId,location_id:line.locationId,quantity:line.quantity}))});if(error)throw error},
 async review(id:string,decision:'APPROVED'|'REJECTED',reason?:string):Promise<void>{if(!supabase)throw new Error('Supabase is not configured');const {error}=await supabase.rpc('review_issue_request',{p_request_id:id,p_decision:decision,p_rejection_reason:reason||null});if(error)throw error},
 async cancel(id:string):Promise<void>{if(!supabase)throw new Error('Supabase is not configured');const {error}=await supabase.rpc('cancel_issue_request',{p_request_id:id});if(error)throw error},
}
