const formulaPrefix=/^[\t\r ]*[=+\-@]/

export const csvCell=(value:unknown)=>{
  const raw=String(value??'')
  const safe=typeof value==='string'&&formulaPrefix.test(raw)?`'${raw}`:raw
  return `"${safe.replaceAll('"','""')}"`
}

export const csvText=(rows:unknown[][])=>'\ufeff'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n')
