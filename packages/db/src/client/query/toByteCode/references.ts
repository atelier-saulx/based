import { filterToBuffer } from '../query.js'
import { QueryDef, includeOp } from '../types.js'
import { createSortBuffer } from '../sort.js'
import { writeUint16, writeUint32 } from '@based/utils'
import { REFERENCES } from './constants.js'

export const referencesQuery = (def: QueryDef, size: number) => {
  const filterSize = def.filter.size || 0

  let sort: Uint8Array
  let sortSize = 0
  if (def.sort) {
    sort = createSortBuffer(def.sort)
    sortSize = sort.byteLength
  }

  const modsSize = filterSize + sortSize
  const buf = new Uint8Array(REFERENCES.baseSize + modsSize)
  const sz = size + 7 + modsSize + 8

  buf[REFERENCES.includeOp] = includeOp.REFERENCES
  writeUint16(buf, sz, REFERENCES.size)
  writeUint16(buf, filterSize, REFERENCES.filterSize)
  writeUint16(buf, sortSize, REFERENCES.sortSize)
  writeUint32(buf, def.range.offset, REFERENCES.offset)
  writeUint32(buf, def.range.limit, REFERENCES.limit)

  let index = REFERENCES.filter
  if (filterSize) {
    buf.set(filterToBuffer(def.filter), index)
    index += filterSize
  }
  if (sort) {
    buf.set(sort, index)
    index += sortSize
  }

  writeUint16(buf, def.schema.id, index)
  buf[index + 2] = (def.target as any).propDef.prop

  return buf
}
