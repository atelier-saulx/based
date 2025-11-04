import { filterToBuffer, isSimpleMainFilter } from '../query.js'
import { QueryDef, QueryType } from '../types.js'
import { writeUint16, writeUint32 } from '@based/utils'
import { DEFAULT } from './constants.js'

export const defaultQuery = (
  def: QueryDef,
  filterSize: number,
  sortSize: number,
  searchSize: number,
  sort: Uint8Array,
  search: Uint8Array,
) => {
  const buf = new Uint8Array(
    DEFAULT.baseSize + filterSize + sortSize + searchSize,
  )
  let index = 0
  buf[index++] = QueryType.default
  writeUint16(buf, def.schema.id, index)
  index += 2
  writeUint32(buf, def.range.offset, index)
  index += 4
  writeUint32(buf, def.range.limit, index)
  index += 4

  writeUint16(buf, filterSize, index)
  index += 2
  buf[index++] = filterSize && isSimpleMainFilter(def.filter) ? 1 : 0

  if (filterSize) {
    buf.set(filterToBuffer(def.filter), index)
    index += filterSize
  }

  writeUint16(buf, sortSize, index)
  index += 2
  if (sortSize) {
    buf.set(sort, index)
    index += sortSize
  }

  writeUint16(buf, searchSize, index)
  index += 2
  if (searchSize) {
    buf.set(search, index)
  }
  return buf
}
