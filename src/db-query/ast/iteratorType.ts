import {
  QUERY_ITERATOR_DEFAULT,
  QUERY_ITERATOR_EDGE,
  QUERY_ITERATOR_EDGE_INCLUDE,
  QUERY_ITERATOR_SEARCH,
  QUERY_ITERATOR_SEARCH_VEC,
  QueryIteratorTypeEnum,
  QueryHeader,
  QueryIteratorType,
  QueryIteratorTypeInverse,
} from '../../zigTsExports.js'
import { QueryAst } from './ast.js'

export const getIteratorType = (
  header: QueryHeader,
  ast: QueryAst,
): QueryIteratorTypeEnum => {
  const hasFilter: boolean = header.filterSize != 0
  const edge: boolean = header.edgeTypeId != 0
  const edgeInclude: boolean = header.edgeSize != 0
  const hasSort = header.sort
  const isDesc = ast.order === 'desc'
  const hasSearch = false
  const isVector = false

  let base = QUERY_ITERATOR_DEFAULT

  if (edge && !edgeInclude) {
    base = QUERY_ITERATOR_EDGE
  }

  if (edgeInclude) {
    base = QUERY_ITERATOR_EDGE_INCLUDE
  }

  // if (hasSearch && !isVector) {
  //   base = QUERY_ITERATOR_SEARCH
  // }

  // if (hasSearch && isVector) {
  //   base = QUERY_ITERATOR_SEARCH_VEC
  // }

  // if (hasSearch) {
  //   if (hasFilter) {
  //     base += 1
  //   }
  // }

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
  } else if (hasFilter) {
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

  return base as QueryIteratorTypeEnum
}
