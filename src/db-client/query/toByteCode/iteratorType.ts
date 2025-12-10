import {
  ID_PROP,
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
  const hasSort = def.sort?.prop !== ID_PROP
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

  // console.log('QueryIteratorTypeEnum', QueryIteratorTypeInverse[base])

  return base as QueryIteratorTypeEnum
}
