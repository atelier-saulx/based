import {
  QUERY_ITERATOR_DEFAULT,
  QUERY_ITERATOR_EDGE,
  QUERY_ITERATOR_EDGE_INCLUDE,
  QUERY_ITERATOR_SEARCH,
  QUERY_ITERATOR_SEARCH_VEC,
  QueryIteratorTypeEnum,
  SortOrder,
} from '../../../zigTsExports.js'
import { QueryDef } from '../types.js'

export const NO_EDGE = 0
export const EDGE_INCLUDE = 1
export const HAS_EDGE = 2

export const getIteratorType = (
  def: QueryDef,
  edges: typeof EDGE_INCLUDE | typeof HAS_EDGE | typeof NO_EDGE,
): QueryIteratorTypeEnum => {
  const hasSearch = def.search?.size && def.search.size > 0
  const isVector = hasSearch && def.search!.isVector
  const hasFilter = def.filter.size > 0
  const isDesc = def.sort?.order === SortOrder.desc

  let base = QUERY_ITERATOR_DEFAULT

  if (edges === HAS_EDGE) {
    base = QUERY_ITERATOR_EDGE
  }

  if (edges === EDGE_INCLUDE) {
    base = QUERY_ITERATOR_EDGE_INCLUDE
  }

  if (hasSearch && !isVector) {
    base = QUERY_ITERATOR_SEARCH
  }

  if (hasSearch && isVector) {
    base = QUERY_ITERATOR_SEARCH_VEC
  }

  if (hasFilter && isDesc) {
    base += 3
  }

  if (hasSearch && isDesc) {
    console.warn('Has search and is Desc not supported')
    if (hasFilter) {
      base += 1
    }
    return base as QueryIteratorTypeEnum
  }

  if (hasFilter && isDesc) {
    base += 3
  }

  if (hasFilter) {
    base += 1
  }

  return base as QueryIteratorTypeEnum
}
