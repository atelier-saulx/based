import { print, FieldNode, EnumValueNode } from 'graphql'
import { stringOrVariable, valueOrVariable } from '../util'
import { filterToFindFilter } from './filter'

export function makeAggregate(
  graphqlAst: FieldNode,
  variables: Record<string, any>
): any {
  const edgeField = stringOrVariable(
    graphqlAst.arguments.find((a) => {
      return a.name.value === 'edgeField'
    })?.value,
    variables
  )

  if (!edgeField) {
    return undefined
  }

  const fnEnum = graphqlAst.arguments.find((a) => {
    return a.name.value === 'function'
  })?.value
  const fn = (<EnumValueNode>fnEnum)?.value.toLowerCase()

  if (!fn) {
    return undefined
  }

  const args = valueOrVariable(
    graphqlAst.arguments.find((a) => {
      return a.name.value === 'args'
    })?.value
  )

  const filterAst = graphqlAst.arguments.find((a) => {
    return a.name.value === 'filter'
  })

  const filter = filterToFindFilter(filterAst, new Set(), variables)

  return {
    $aggregate: {
      $traverse: edgeField,
      $function: { $name: fn, $args: args },
      $filter: filter,
    },
  }
}
