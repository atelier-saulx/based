import { QueryDef, QueryDefSort } from './types.js'
import { validateSort } from './validation.js'

export const createSortBuffer = (sort: QueryDefSort) => {
  const buf = new Uint8Array(8)
  // [order] [propType] [start] [start] [len] [len] [lang]
  buf[0] = sort.order
  buf[1] = sort.prop.id
  buf[2] = sort.prop.typeIndex
  if ('main' in sort.prop) {
    buf[3] = sort.prop.main.start
    buf[4] = sort.prop.main.start >>> 8
    buf[5] = sort.prop.main.size
    buf[6] = sort.prop.main.size >>> 8
  } else {
    buf[3] = 0
    buf[4] = 0
    buf[5] = 0
    buf[6] = 0
  }
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
