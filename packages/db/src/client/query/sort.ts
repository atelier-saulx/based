import { QueryDef, QueryDefSort } from './types.js'
import { validateSort } from './validation.js'

export const createSortBuffer = (sort: QueryDefSort) => {
  const buf = new Uint8Array(8)
  // [order] [propType] [start] [start] [len] [len] [lang]
  buf[0] = sort.order
  buf[1] = sort.prop.prop
  buf[2] = sort.prop.typeIndex
  buf[3] = sort.prop.start
  buf[4] = sort.prop.start >>> 8
  buf[5] = sort.prop.len
  buf[6] = sort.prop.len >>> 8
  buf[7] = sort.lang
  return buf
}

// NO REF / REFERENCES SUPPORT
export const sort = (def: QueryDef, field: string, order?: 'asc' | 'desc') => {
  if (field === 'id' && order === 'asc') {
    return
  }
  def.sort = validateSort(def, field, order)
}
