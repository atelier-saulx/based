import { QueryDef, QueryDefSort } from './types.js'
import { validateSort } from './validation.js'

export const createSortBuffer = (sort: QueryDefSort) => {
  const buf = Buffer.allocUnsafe(8)
  // [order] [propType] [start] [start] [len] [len] [lang]
  buf[0] = sort.order
  buf[1] = sort.prop.prop
  buf[2] = sort.prop.typeIndex
  buf.writeUint16LE(sort.prop.start, 3)
  buf.writeUint16LE(sort.prop.len, 5)
  buf[7] = sort.lang

  //[LANG]
  return buf
}

// NO REF / REFERENCES SUPPORT
export const sort = (def: QueryDef, field: string, order?: 'asc' | 'desc') => {
  def.sort = validateSort(def, field, order)
}
