import { Filter } from '../types'
import { ArgumentNode, ValueNode } from 'graphql'
import { stringOrVariable, valueOrVariable } from '../util'

export function filterToFindFilter(
  graphqlAst: ArgumentNode,
  typeFilters: Set<string>,
  variables: Record<string, any> = {}
) {
  if (!graphqlAst?.value && !typeFilters?.size) {
    return undefined
  }

  const f = []

  if (graphqlAst?.value) {
    if (graphqlAst?.value.kind !== 'ObjectValue') {
      throw new Error(
        `Invalid filter ${JSON.stringify(graphqlAst.value, null, 2)}`
      )
    }

    const userFilter = transpileFilters(graphqlAst.value, variables)
    f.push(userFilter)
  }

  if (typeFilters?.size) {
    f.push({
      $field: 'type',
      $operator: '=',
      $value: [...typeFilters],
    })
  }

  return f
}

export function transpileFilters(
  graphqlAst: ValueNode,
  variables: Record<string, any> = {}
) {
  const OP_MAP = {
    EQ: '=',
    NEQ: '!=',
    LT: '<',
    GT: '>',
    EXISTS: 'exists',
    NOT_EXISTS: 'notExists',
    HAS: 'has',
  }

  if (graphqlAst.kind !== 'ObjectValue') {
    return undefined
  }

  const op =
    // @ts-ignore
    graphqlAst.fields.find((f) => f?.name?.value === 'op')?.value?.value
  const $field = stringOrVariable(
    graphqlAst.fields.find((f) => f?.name?.value === 'field')?.value,
    variables
  )
  const $value = valueOrVariable(
    graphqlAst.fields.find((f) => f?.name?.value === 'value')?.value,
    variables
  )

  if (!OP_MAP[op] || !$field || $value === undefined || $value === null) {
    return undefined
  }

  const and = graphqlAst.fields.find((f) => f?.name?.value === 'and')?.value
  const or = graphqlAst.fields.find((f) => f?.name?.value === 'or')?.value

  const f: Filter = {
    $operator: OP_MAP[op],
    // @ts-ignore
    $field,
    // @ts-ignore
    $value,
  }

  if (and) {
    f.$and = transpileFilters(and, variables)
  } else if (or) {
    f.$or = transpileFilters(or, variables)
  }

  return f
}
