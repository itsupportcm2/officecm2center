import { supabase } from '../lib/supabase'

export interface AppSettings{companyName:string;systemName:string;adminEmail:string;lowStock:boolean;outOfStock:boolean;renewals:boolean;weekly:boolean}
export const defaultSettings:AppSettings={companyName:'บริษัท เชียงใหม่โฟรเซ่นฟูดส์ จำกัด',systemName:'ระบบจัดการสำนักงาน เชียงใหม่โฟรเซ่นฟูดส์',adminEmail:'admin@example.co.th',lowStock:true,outOfStock:true,renewals:true,weekly:false}
const map=(row:any):AppSettings=>({companyName:String(row.company_name),systemName:String(row.system_name),adminEmail:String(row.admin_email),lowStock:Boolean(row.low_stock_alert),outOfStock:Boolean(row.out_of_stock_alert),renewals:Boolean(row.renewal_alert),weekly:Boolean(row.weekly_summary)})
export const settingsService={
 async load(){if(!supabase)return defaultSettings;const {data,error}=await supabase.from('app_settings').select('*').eq('id',true).single();if(error)throw error;return map(data)},
 async save(value:AppSettings){if(!supabase)return;const {error}=await supabase.from('app_settings').update({company_name:value.companyName,system_name:value.systemName,admin_email:value.adminEmail,low_stock_alert:value.lowStock,out_of_stock_alert:value.outOfStock,renewal_alert:value.renewals,weekly_summary:value.weekly}).eq('id',true);if(error)throw error},
}
