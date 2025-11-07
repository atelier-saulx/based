import { filterToBuffer, isSimpleMainFilter } from '../query.js'
import { QueryDef, QueryType, IntermediateByteCode } from '../types.js'
import { writeUint16, writeUint32 } from '@based/utils'
import { DEFAULT } from './offsets.js'

export const defaultQuery = (
  def: QueryDef,
  filterSize: number,
  sortSize: number,
  searchSize: number,
  sort: Uint8Array,
  search: Uint8Array,
): IntermediateByteCode => {
  const buffer = new Uint8Array(
    DEFAULT.baseSize + filterSize + sortSize + searchSize,
  )
  let index = 0
  buffer[index++] = QueryType.default
  writeUint16(buffer, def.schema.id, index)
  index += 2
  writeUint32(buffer, def.range.offset, index)
  index += 4
  writeUint32(buffer, def.range.limit, index)
  index += 4

  writeUint16(buffer, filterSize, index)
  index += 2
  buffer[index++] = filterSize && isSimpleMainFilter(def.filter) ? 1 : 0

  if (filterSize) {
    buffer.set(filterToBuffer(def.filter, index), index)
    index += filterSize
  }

  writeUint16(buffer, sortSize, index)
  index += 2
  if (sortSize) {
    buffer.set(sort, index)
    index += sortSize
  }

  writeUint16(buffer, searchSize, index)
  index += 2
  if (searchSize) {
    buffer.set(search, index)
  }

  return { buffer, def, needsMetaResolve: def.filter.hasSubMeta }
}
