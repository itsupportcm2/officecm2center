import { describe, expect, it } from 'vitest'
import { csvCell, csvText } from './csv'

describe('CSV export safety',()=>{
  it.each(['=SUM(A1:A2)','+cmd','-1+2','@IMPORTXML(A1)'])('neutralizes spreadsheet formula %s',value=>{
    expect(csvCell(value)).toBe(`"'${value}"`)
  })

  it('escapes quotes and writes a UTF-8 BOM',()=>{
    expect(csvText([['ชื่อ "สินค้า"',2]])).toBe('\ufeff"ชื่อ ""สินค้า""","2"')
  })
})
