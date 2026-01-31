import {
  ID_PROP,
  QUERY_ITERATOR_DEFAULT,
  QUERY_ITERATOR_EDGE,
  QUERY_ITERATOR_EDGE_INCLUDE,
  QUERY_ITERATOR_SEARCH,
  QUERY_ITERATOR_SEARCH_VEC,
  QueryIteratorTypeEnum,
  Order,
  QueryHeader,
} from '../../zigTsExports.js'
import { QueryDef, QueryDefType } from '../../db-client/query/types.js'

export const getIteratorType = (header: QueryHeader): QueryIteratorTypeEnum => {
  const hasFilter: boolean = header.filterSize != 0
  const edge: boolean = header.edgeTypeId != 0
  const edgeInclude: boolean = header.edgeSize != 0

  // const hasFilter = def.filter.size > 0
  const hasSort = false //
  const isDesc = false // def.order === Order.desc
  const hasSearch = false //def.search?.size && def.search.size > 0
  const isVector = false // hasSearch && def.search!.isVector
  // def.sort &&
  // (def.sort.prop !== ID_PROP || def.type === QueryDefType.References)
  // def.type === QueryDefType.References &&

  let base = QUERY_ITERATOR_DEFAULT

  if (edge && !edgeInclude) {
    base = QUERY_ITERATOR_EDGE
  }

  if (edgeInclude) {
    base = QUERY_ITERATOR_EDGE_INCLUDE
  }

  if (hasSearch && !isVector) {
    base = QUERY_ITERATOR_SEARCH
  }

  if (hasSearch && isVector) {
    base = QUERY_ITERATOR_SEARCH_VEC
  }

  if (hasSearch) {
    if (hasFilter) {
      base += 1
    }
  } else {
    if (hasSort) {
      if (hasFilter) {
        if (isDesc) {
          base += 7
        } else {
          base += 3
        }
      } else if (isDesc) {
        base += 5
      } else {
        base += 1
      }
    } else {
      if (hasFilter) {
        if (isDesc) {
          base += 6
        } else {
          base += 2
        }
      } else if (isDesc) {
        base += 4
      } else {
        base += 0
      }
    }
  }

  return base as QueryIteratorTypeEnum
}
