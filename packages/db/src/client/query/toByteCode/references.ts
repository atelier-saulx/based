import { filterToBuffer } from '../query.js'
import { QueryDef, includeOp, IntermediateByteCode } from '../types.js'
import { createSortBuffer } from '../sort.js'
import { writeUint16, writeUint32 } from '@based/utils'
import { REFERENCES } from './offsets.js'

export const referencesQuery = (
  def: QueryDef,
  size: number,
): IntermediateByteCode => {
  const filterSize = def.filter.size || 0

  let sort: Uint8Array
  let sortSize = 0
  if (def.sort) {
    sort = createSortBuffer(def.sort)
    sortSize = sort.byteLength
  }

  const modsSize = filterSize + sortSize
  const buffer = new Uint8Array(REFERENCES.baseSize + modsSize)
  const sz = size + 7 + modsSize + 8

  buffer[REFERENCES.includeOp] = includeOp.REFERENCES
  writeUint16(buffer, sz, REFERENCES.size)
  writeUint16(buffer, filterSize, REFERENCES.filterSize)
  writeUint16(buffer, sortSize, REFERENCES.sortSize)
  writeUint32(buffer, def.range.offset, REFERENCES.offset)
  writeUint32(buffer, def.range.limit, REFERENCES.limit)

  let index = REFERENCES.filter
  if (filterSize) {
    buffer.set(filterToBuffer(def.filter, index), index)
    index += filterSize
  }
  if (sort) {
    buffer.set(sort, index)
    index += sortSize
  }

  writeUint16(buffer, def.schema.id, index)
  buffer[index + 2] = (def.target as any).propDef.prop

  return { buffer, def }
}
