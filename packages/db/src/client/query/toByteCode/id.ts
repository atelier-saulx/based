import { filterToBuffer } from '../query.js'
import { QueryDef, QueryType } from '../types.js'
import { writeUint16, writeUint32 } from '@based/utils'
import { ID } from './offsets.js'

export const idQuery = (def: QueryDef) => {
  const filterSize = def.filter.size || 0
  const buf = new Uint8Array(ID.baseSize + filterSize)
  buf[ID.queryType] = QueryType.id
  writeUint16(buf, def.schema.id, ID.type)
  writeUint32(buf, (def.target as any).id, ID.id)
  writeUint16(buf, filterSize, ID.filterSize)
  if (filterSize) {
    buf.set(filterToBuffer(def.filter), ID.filter)
  }
  return buf
}
