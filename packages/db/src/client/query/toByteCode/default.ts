import { filterToBuffer } from '../query.js'
import { QueryDef, QueryType, IntermediateByteCode } from '../types.js'
import { getQuerySubType } from './subType.js'
import {
  ID_PROP,
  QueryHeaderByteSize,
  SortHeaderByteSize,
  writeQueryHeader,
  writeSortHeader,
} from '../../../zigTsExports.js'
import { searchToBuffer } from '../search/index.js'
import { includeToBuffer } from '../include/toByteCode.js'
import { DbClient } from '../../../index.js'

export const defaultQuery = (
  db: DbClient,
  def: QueryDef,
): IntermediateByteCode => {
  const hasSort = def.sort?.prop !== ID_PROP && !!def.sort
  const hasSearch = !!def.search
  const hasFilter = def.filter.size > 0
  const searchSize = hasSearch ? def.search.size : 0
  const sortSize = hasSort ? SortHeaderByteSize : 0
  const filterSize = def.filter.size

  const buffer = new Uint8Array(
    QueryHeaderByteSize + searchSize + filterSize + sortSize,
  )

  let index = writeQueryHeader(
    buffer,
    {
      op: QueryType.default,
      typeId: def.schema.id,
      offset: def.range.offset,
      limit: def.range.limit,
      sort: hasSort,
      edge: false,
      refProp: 0,
      filterSize: def.filter.size,
      searchSize,
      subType: getQuerySubType(def),
    },
    0,
  )

  if (hasSort) {
    index = writeSortHeader(buffer, def.sort, index)
  }

  if (hasFilter) {
    buffer.set(filterToBuffer(def.filter, index), index)
    index += def.filter.size
  }

  if (hasSearch) {
    buffer.set(searchToBuffer(def.search), index)
  }

  return [
    { buffer, def, needsMetaResolve: def.filter.hasSubMeta },
    includeToBuffer(db, def),
  ]
}
