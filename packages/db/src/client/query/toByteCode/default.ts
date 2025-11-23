import { filterToBuffer } from '../query.js'
import { QueryDef, QueryType, IntermediateByteCode } from '../types.js'
import { getQuerySubType } from './subType.js'
import {
  ID_PROP,
  QueryDefaultHeaderByteSize,
  SortHeaderByteSize,
  SortOrder,
  writeQueryDefaultHeader,
  writeQueryDefaultHeaderProps,
  writeSortHeader,
} from '../../../zigTsExports.js'

export const defaultQuery = (
  def: QueryDef,
  filterSize: number,
  searchSize: number,
  search: Uint8Array,
): IntermediateByteCode => {
  let sortSize = 0
  const idDescSort = def.sort?.prop === ID_PROP

  if (def.sort && !idDescSort) {
    sortSize = SortHeaderByteSize
  }

  console.log(sortSize, def.sort)

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
      // to this thing pass the sort object...
      subType: getQuerySubType(
        filterSize,
        sortSize,
        searchSize,
        def.sort?.order === SortOrder.desc,
        idDescSort,
        searchSize > 0 && search[0] === 1,
      ),
    },
    index,
  )

  if (sortSize) {
    index = writeSortHeader(buffer, def.sort, index)
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
