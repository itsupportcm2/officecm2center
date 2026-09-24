import { bangkokDateKey } from '../utils/date'

export const LOCAL_DATA_KEYS=[
 'cm-office-items-v2',
 'cm-office-categories-v2',
 'cm-office-locations-v2',
 'cm-office-transactions-v2',
 'cm-office-balances-v1',
 'cm-office-renewals-v1',
 'cm-office-renewal-history-v1',
 'cm-office-purchase-requests-v1',
 'cm-office-users-v1',
 'cm-office-settings-v1',
 'cm-office-audit-v1',
] as const

export interface LocalBackupFile{
 application:'cm-office-stock'
 schemaVersion:1
 exportedAt:string
 data:Record<string,unknown>
}

export const createLocalBackup=():LocalBackupFile=>({
 application:'cm-office-stock',
 schemaVersion:1,
 exportedAt:new Date().toISOString(),
 data:Object.fromEntries(LOCAL_DATA_KEYS.map(key=>{const value=localStorage.getItem(key);return [key,value===null?null:JSON.parse(value)]})),
})

export const downloadLocalBackup=()=>{
 const backup=createLocalBackup()
 const url=URL.createObjectURL(new Blob([JSON.stringify(backup,null,2)],{type:'application/json;charset=utf-8'}))
 const link=document.createElement('a')
 link.href=url
 link.download=`cm-office-backup-${bangkokDateKey()}.json`
 link.click()
 URL.revokeObjectURL(url)
 return backup
}

export const parseLocalBackup=(text:string):LocalBackupFile=>{
 const parsed:unknown=JSON.parse(text)
 if(!parsed||typeof parsed!=='object')throw new Error('รูปแบบไฟล์ไม่ถูกต้อง')
 const file=parsed as Partial<LocalBackupFile>
 if(file.application!=='cm-office-stock'||file.schemaVersion!==1||!file.data||typeof file.data!=='object')throw new Error('ไฟล์นี้ไม่ใช่ข้อมูลสำรองของระบบ หรือเวอร์ชันไม่รองรับ')
 return file as LocalBackupFile
}

export const restoreLocalBackup=(backup:LocalBackupFile)=>{
 for(const key of LOCAL_DATA_KEYS){
  const value=backup.data[key]
  if(value===null||value===undefined)localStorage.removeItem(key)
  else localStorage.setItem(key,JSON.stringify(value))
 }
}
