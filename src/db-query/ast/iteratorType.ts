import {
  QueryIteratorTypeEnum,
  QueryHeader,
  FilterType,
  QueryIteratorType,
} from '../../zigTsExports.js'
import { QueryAst } from './ast.js'

export const getIteratorType = (
  header: QueryHeader,
  ast: QueryAst,
): QueryIteratorTypeEnum => {
  const hasFilter: boolean = header.filterSize != 0
  const hasSort = header.sort
  const isDesc = ast.order === 'desc'

  if (!hasFilter) {
    if (hasSort) {
      return isDesc ? QueryIteratorType.descSort : QueryIteratorType.sort
    } else {
      return isDesc ? QueryIteratorType.desc : QueryIteratorType.default
    }
  }

  const filterType = ast.filter?.filterType

  if (filterType === FilterType.edgeOnly) {
    if (hasSort) {
      return isDesc
        ? QueryIteratorType.descFilterSortEdge
        : QueryIteratorType.filterSortEdge
    } else {
      return isDesc
        ? QueryIteratorType.descFilterEdge
        : QueryIteratorType.filterEdge
    }
  }

  if (filterType === FilterType.mixed) {
    if (hasSort) {
      return isDesc
        ? QueryIteratorType.descFilterSortEdgeAndProp
        : QueryIteratorType.filterSortEdgeAndProp
    } else {
      return isDesc
        ? QueryIteratorType.descFilterEdgeAndProp
        : QueryIteratorType.filterEdgeAndProp
    }
  }

  if (hasSort) {
    return isDesc
      ? QueryIteratorType.descFilterSort
      : QueryIteratorType.filterSort
  } else {
    return isDesc ? QueryIteratorType.descFilter : QueryIteratorType.filter
  }
}
