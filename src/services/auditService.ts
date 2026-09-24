import { supabase } from '../lib/supabase'
import type { AuditAction, AuditEntry } from '../store/AuditContext'

const allowed=new Set<AuditAction>(['CREATE','UPDATE','DELETE','STOCK_IN','STOCK_OUT','STOCK_ADJUST','STOCK_TRANSFER','PURCHASE_CREATE','PURCHASE_UPDATE','RENEW','BACKUP','RESTORE','SETTINGS'])
export const auditService={
 async load():Promise<AuditEntry[]>{if(!supabase)return [];const [{data,error},{data:profiles,error:profileError}]=await Promise.all([supabase.from('audit_logs').select('*').order('created_at',{ascending:false}).limit(1000),supabase.from('profiles').select('id,full_name')]);if(error||profileError)throw error??profileError;const names=new Map((profiles??[]).map((row:any)=>[String(row.id),String(row.full_name)]));return (data??[]).map((row:any)=>{const raw=String(row.event_type??row.action);const action=(allowed.has(raw as AuditAction)?raw:'UPDATE') as AuditAction;return {id:String(row.id),action,entity:String(row.table_name),entityId:row.record_id??undefined,title:String(row.title??row.table_name),detail:String(row.detail??row.action),actor:names.get(String(row.actor_id))??'ระบบ',createdAt:String(row.created_at)}})},
 async record(entry:Omit<AuditEntry,'id'|'actor'|'createdAt'>){if(!supabase||!['BACKUP','RESTORE'].includes(entry.action))return;const {error}=await supabase.rpc('record_app_audit',{p_event_type:entry.action,p_entity:entry.entity,p_entity_id:entry.entityId??null,p_title:entry.title,p_detail:entry.detail});if(error)throw error},
}
