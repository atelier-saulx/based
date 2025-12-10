import {
  QUERY_ITERATOR_DEFAULT,
  QUERY_ITERATOR_EDGE,
  QUERY_ITERATOR_EDGE_INCLUDE,
  QUERY_ITERATOR_SEARCH,
  QUERY_ITERATOR_SEARCH_VEC,
  QueryIteratorTypeEnum,
  QueryIteratorTypeInverse,
  SortOrder,
} from '../../../zigTsExports.js'
import { QueryDef, QueryDefType } from '../types.js'

export const getIteratorType = (def: QueryDef): QueryIteratorTypeEnum => {
  const hasSearch = def.search?.size && def.search.size > 0
  const isVector = hasSearch && def.search!.isVector
  const hasFilter = def.filter.size > 0
  const isDesc = def.sort?.order === SortOrder.desc
  const edgeInclude = def.edges
  const hasEdges =
    def.type === QueryDefType.References &&
    // @ts-ignore
    def.target.propDef.edgeNodeTypeId > 0

  let base = QUERY_ITERATOR_DEFAULT

  if (hasEdges && !edgeInclude) {
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

  //  default: 0,
  //   filter: 1,
  //   desc: 2,
  //   descFilter: 3,
  //   edge: 20,
  //   edgeFilter: 21,
  //   edgeDesc: 22,
  //   edgeDescFilter: 23,
  //   edgeInclude: 30,
  //   edgeIncludeFilter: 31,
  //   edgeIncludeDesc: 32,
  //   edgeIncludeDescFilter: 33,
  //   search: 120,
  //   searchFilter: 121,
  //   vec: 130,
  //   vecFilter: 131,

  if (hasSearch) {
    if (hasFilter) {
      base += 1
    }
  } else {
    if (isDesc) {
      base += 2
    }
    if (hasFilter) {
      base += 1
    }
  }

  console.log('QueryIteratorTypeEnum', QueryIteratorTypeInverse[base])

  return base as QueryIteratorTypeEnum
}
