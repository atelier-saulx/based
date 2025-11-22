import { filterToBuffer } from '../query.js'
import { QueryDef, QueryType, IntermediateByteCode } from '../types.js'
import { getQuerySubType } from './subType.js'
import { ID } from '@based/schema/prop-types'
import {
  QueryDefaultHeaderByteSize,
  writeQueryDefaultHeader,
} from '../../../zigTsExports.js'

export const defaultQuery = (
  def: QueryDef,
  filterSize: number,
  sortSize: number,
  searchSize: number,
  sort: Uint8Array,
  search: Uint8Array,
): IntermediateByteCode => {
  const idDescSort = sortSize > 0 ? sort[1] === ID : false
  if (idDescSort) {
    sortSize = 0
  }

  const buffer = new Uint8Array(
    1 + QueryDefaultHeaderByteSize + filterSize + sortSize + searchSize,
  )

  let index = 0
  buffer[index++] = QueryType.default

  index = writeQueryDefaultHeader(
    buffer,
    {
      typeId: def.schema.id,
      offset: def.range.offset,
      limit: def.range.limit,
      sortSize,
      filterSize,
      searchSize,
      subType: getQuerySubType(
        filterSize,
        sortSize,
        searchSize,
        sortSize > 0 && sort[0] == 1,
        idDescSort,
        searchSize > 0 && search[0] === 1,
      ),
    },
    index,
  )

  if (sortSize) {
    buffer.set(sort, index)
    index += sortSize
  }

  if (filterSize) {
    buffer.set(filterToBuffer(def.filter, index), index)
    index += filterSize
  }

  if (searchSize) {
    buffer.set(search, index)
  }

  return { buffer, def, needsMetaResolve: def.filter.hasSubMeta }
}
