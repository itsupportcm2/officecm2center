export const BANGKOK_TIME_ZONE='Asia/Bangkok'

export const bangkokDateKey=(value:Date|string=new Date())=>{
 const date=typeof value==='string'?new Date(value):value
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:BANGKOK_TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date)
 const read=(type:Intl.DateTimeFormatPartTypes)=>parts.find(part=>part.type===type)?.value??''
 return `${read('year')}-${read('month')}-${read('day')}`
}

export const formatThaiDate=(value:Date|string=new Date(),options:Intl.DateTimeFormatOptions={dateStyle:'full'})=>
 new Intl.DateTimeFormat('th-TH',{...options,timeZone:BANGKOK_TIME_ZONE}).format(typeof value==='string'?new Date(value):value)

export const formatThaiDateTime=(value:Date|string)=>
 new Intl.DateTimeFormat('th-TH',{dateStyle:'short',timeStyle:'short',timeZone:BANGKOK_TIME_ZONE}).format(typeof value==='string'?new Date(value):value)
