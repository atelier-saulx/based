import { FilterAst } from './ast.js'

export const findIds = (filterAst?: FilterAst): number[] | undefined => {
  if (!filterAst) return undefined

  let propsIds: number[] | undefined = undefined
  if (filterAst.props && filterAst.props.id && filterAst.props.id.ops) {
    for (const op of filterAst.props.id.ops) {
      if (op.op === '=') {
        if (typeof op.val === 'number') {
          if (!propsIds) propsIds = []
          propsIds.push(op.val)
        } else if (Array.isArray(op.val)) {
          if (!propsIds) propsIds = []
          for (const v of op.val) {
            if (typeof v === 'number') propsIds.push(v)
          }
        }
      }
    }
  }

  const andIds = findIds(filterAst.and)

  let termIds: number[] | undefined = undefined
  if (propsIds && andIds) {
    const set = new Set(andIds)
    termIds = propsIds.filter((id) => set.has(id))
  } else if (propsIds) {
    termIds = propsIds
  } else if (andIds) {
    termIds = andIds
  }

  if (filterAst.or) {
    const orIds = findIds(filterAst.or)
    if (!termIds || !orIds) {
      return undefined
    }
    const set = new Set([...termIds, ...orIds])
    return Array.from(set)
  }

  if (termIds && termIds.length > 0) {
    return Array.from(new Set(termIds))
  }

  return undefined
}

export const cleanAst = (filterAst?: FilterAst): boolean => {
  if (!filterAst) return true

  let isEmpty = true

  if (filterAst.props) {
    if (filterAst.props.id && filterAst.props.id.ops) {
      filterAst.props.id.ops = filterAst.props.id.ops.filter(
        (op) => op.op !== '=',
      )
      if (filterAst.props.id.ops.length === 0) {
        delete filterAst.props.id
      }
    }

    // Check if props is empty
    let hasProps = false
    for (const _ in filterAst.props) {
      hasProps = true
      break
    }
    if (!hasProps) {
      delete filterAst.props
    } else {
      isEmpty = false
    }
  }

  if (filterAst.and) {
    if (cleanAst(filterAst.and)) {
      delete filterAst.and
    } else {
      isEmpty = false
    }
  }

  if (filterAst.or) {
    if (cleanAst(filterAst.or)) {
      delete filterAst.or
    } else {
      isEmpty = false
    }
  }

  if (filterAst.edges) {
    if (cleanAst(filterAst.edges)) {
      delete filterAst.edges
    } else {
      isEmpty = false
    }
  }

  if (filterAst.filterType !== undefined) {
    isEmpty = false
  }

  return isEmpty
}
