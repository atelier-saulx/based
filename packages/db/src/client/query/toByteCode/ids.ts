import { filterToBuffer } from '../query.js'
import { QueryDef, QueryType } from '../types.js'
import { searchToBuffer } from '../search/index.js'
import { createSortBuffer } from '../sort.js'
import { writeUint16, writeUint32 } from '@based/utils'
import { IDS } from './constants.js'

export const idsQuery = (def: QueryDef) => {
  const filterSize = def.filter.size || 0

  let sort: Uint8Array
  let sortSize = 0
  if (def.sort) {
    sort = createSortBuffer(def.sort)
    sortSize = sort.byteLength
  }

  let search: Uint8Array
  let searchSize = 0
  if (def.search) {
    search = searchToBuffer(def.search)
    searchSize = def.search.size
  }

  const idsSize = (def.target as any).ids.length * 4
  const buf = new Uint8Array(
    IDS.baseSize + idsSize + filterSize + sortSize + searchSize,
  )

  let index = 0
  buf[IDS.queryType] = QueryType.ids
  writeUint16(buf, def.schema.id, IDS.type)
  writeUint32(buf, idsSize, IDS.idsSize)
  buf.set(new Uint8Array((def.target as any).ids.buffer), IDS.idsValue)

  index = IDS.idsValue + idsSize
  writeUint32(buf, def.range.offset, index)
  index += 4
  writeUint32(buf, def.range.limit, index)
  index += 4

  writeUint16(buf, filterSize, index)
  index += 2
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
