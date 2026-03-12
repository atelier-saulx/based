import { FilterType, FilterTypeEnum } from '../../../zigTsExports.js'
import { FilterAst } from '../ast.js'

export const getFilterType = (filterAst: FilterAst): FilterTypeEnum => {
  let hasProps = false
  let hasEdges = false

  const check = (ast: FilterAst) => {
    if (ast.props && Object.keys(ast.props).length > 0) {
      hasProps = true
    }
    if (ast.edges) {
      hasEdges = true
    }
    if (ast.and) {
      check(ast.and)
    }
    if (ast.or) {
      check(ast.or)
    }
  }

  check(filterAst)

  if (hasProps && hasEdges) {
    return FilterType.mixed
  } else if (hasEdges) {
    return FilterType.edgeOnly
  } else if (hasProps || filterAst.and || filterAst.or) {
    return FilterType.propOnly
  }

  return FilterType.noFilter
}
