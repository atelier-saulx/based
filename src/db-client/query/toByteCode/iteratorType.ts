import {
  ID_PROP,
  QUERY_ITERATOR_DEFAULT,
  QUERY_ITERATOR_EDGE,
  QUERY_ITERATOR_EDGE_INCLUDE,
  QUERY_ITERATOR_SEARCH,
  QUERY_ITERATOR_SEARCH_VEC,
  QueryIteratorTypeEnum,
  Order,
} from '../../../zigTsExports.js'
import { QueryDef, QueryDefType } from '../types.js'

export const getIteratorType = (
  def: QueryDef,
  hasFilter: boolean,
): QueryIteratorTypeEnum => {
  const hasSearch = false //def.search?.size && def.search.size > 0
  const isVector = false // hasSearch && def.search!.isVector
  // const hasFilter = def.filter.size > 0
  const isDesc = def.order === Order.desc
  const edgeInclude = def.edges
  const hasSort =
    def.sort &&
    (def.sort.prop !== ID_PROP || def.type === QueryDefType.References)
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

  return base as QueryIteratorTypeEnum
}
