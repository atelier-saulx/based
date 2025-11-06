import { filterToBuffer } from '../query.js'
import { QueryDef, QueryType, IntermediateByteCode } from '../types.js'
import { searchToBuffer } from '../search/index.js'
import { createSortBuffer } from '../sort.js'
import { writeUint16, writeUint32 } from '@based/utils'
import { IDS } from './offsets.js'

export const idsQuery = (def: QueryDef): IntermediateByteCode => {
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
  const buffer = new Uint8Array(
    IDS.baseSize + idsSize + filterSize + sortSize + searchSize,
  )

  let index = 0
  buffer[IDS.queryType] = QueryType.ids
  writeUint16(buffer, def.schema.id, IDS.type)
  writeUint32(buffer, idsSize, IDS.idsSize)
  buffer.set(new Uint8Array((def.target as any).ids.buffer), IDS.idsValue)

  index = IDS.idsValue + idsSize
  writeUint32(buffer, def.range.offset, index)
  index += 4
  writeUint32(buffer, def.range.limit, index)
  index += 4

  writeUint16(buffer, filterSize, index)
  index += 2
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
