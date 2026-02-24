import { PropDef } from '../../schema.js'
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
import { EdgeStrategy, QueryAst } from './ast.js'

export const getIteratorType = (
  header: QueryHeader,
  ast: QueryAst,
): QueryIteratorTypeEnum => {
  const hasFilter: boolean = header.filterSize != 0
  const edge: boolean = header.edgeTypeId != 0
  const edgeInclude: boolean = header.edgeSize != 0
  const hasSort = header.sort
  const isDesc = ast.order === 'desc'
  // const hasSearch = false
  // const isVector = false

  let base = QUERY_ITERATOR_DEFAULT

  if (edge && !edgeInclude) {
    base = QUERY_ITERATOR_EDGE
  }

  if (edgeInclude) {
    base = QUERY_ITERATOR_EDGE_INCLUDE
  }

  // console.log('EDGE TIME', edgeInclude, edge)

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

  console.log(
    QueryIteratorTypeInverse[base],
    base,
    QueryIteratorType.edgeFilterOnEdge,
  )

  if (
    ast.filter?.edgeStrategy === EdgeStrategy.edgeOnly ||
    ast.filter?.edgeStrategy === EdgeStrategy.edgeAndProps
  ) {
    if (ast.filter?.edgeStrategy === EdgeStrategy.edgeAndProps) {
      if (header.edgeSize === 0) {
        if (base === QueryIteratorType.edgeFilter) {
          base = QueryIteratorType.edgeFilterAndFilterOnEdge
        } else if (base === QueryIteratorType.edgeDescFilter) {
          base = QueryIteratorType.edgeFilterAndFilterOnEdgeDesc
        } else if (base === QueryIteratorType.edgeFilterSort) {
          base = QueryIteratorType.edgeFilterAndFilterOnEdgeSort
        } else if (base === QueryIteratorType.edgeDescFilterSort) {
          base = QueryIteratorType.edgeFilterAndFilterOnEdgeSortDesc
        }
      } else {
        if (base === QueryIteratorType.edgeIncludeFilter) {
          base = QueryIteratorType.edgeIncludeFilterAndFilterOnEdge
        } else if (base === QueryIteratorType.edgeIncludeDescFilter) {
          base = QueryIteratorType.edgeIncludeFilterAndFilterOnEdgeDesc
        } else if (base === QueryIteratorType.edgeIncludeFilterSort) {
          base = QueryIteratorType.edgeIncludeFilterAndFilterOnEdgeSort
        } else if (base === QueryIteratorType.edgeIncludeDescFilterSort) {
          base = QueryIteratorType.edgeIncludeFilterAndFilterOnEdgeSortDesc
        }
      }
    } else {
      if (header.edgeSize === 0) {
        if (base === QueryIteratorType.edge) {
          base = QueryIteratorType.edgeFilterOnEdge
        } else if (base === QueryIteratorType.edgeDesc) {
          base = QueryIteratorType.edgeFilterOnEdgeDesc
        } else if (base === QueryIteratorType.edgeSort) {
          base = QueryIteratorType.edgeFilterOnEdgeSort
        } else if (base === QueryIteratorType.edgeDescSort) {
          base = QueryIteratorType.edgeFilterOnEdgeSortDesc
        }
      } else {
        if (base === QueryIteratorType.edgeInclude) {
          base = QueryIteratorType.edgeIncludeFilterOnEdge
        } else if (base === QueryIteratorType.edgeIncludeDesc) {
          base = QueryIteratorType.edgeIncludeFilterOnEdgeDesc
        } else if (base === QueryIteratorType.edgeIncludeSort) {
          base = QueryIteratorType.edgeIncludeFilterOnEdgeSort
        } else if (base === QueryIteratorType.edgeIncludeDescSort) {
          base = QueryIteratorType.edgeIncludeFilterOnEdgeSortDesc
        }
      }
    }
  }

  return base as QueryIteratorTypeEnum
}
