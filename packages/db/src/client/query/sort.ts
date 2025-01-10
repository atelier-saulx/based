import { QueryDef, QueryDefSort } from './types.js'

export const createSortBuffer = (sort: QueryDefSort) => {
  const buf = Buffer.allocUnsafe(7)
  // [order] [propType] [start] [start] [len] [len]
  buf[0] = sort.order
  buf[1] = sort.prop.prop
  buf[2] = sort.prop.typeIndex
  buf.writeUint16LE(sort.prop.start, 3)
  buf.writeUint16LE(sort.prop.len, 5)
  return buf
}

// NO REF / REFERENCES SUPPORT
export const sort = (def: QueryDef, field: string, order?: 'asc' | 'desc') => {
  def.sort = {
    prop: def.props[field],
    order: order === 'asc' || order === undefined ? 0 : 1,
  }
}
