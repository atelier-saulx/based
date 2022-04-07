import { Sort } from '@based/types/dist/selvaTypes/get'
import { ArgumentNode, ValueNode } from 'graphql'
import { stringOrVariable, valueOrVariable } from '../util'

export function compileSort(
  graphqlAst: ArgumentNode,
  variables: Record<string, any> = {}
): Sort {
  if (!graphqlAst?.value) {
    return undefined
  }

  const valueNode = graphqlAst.value
  if (valueNode?.kind !== 'ObjectValue') {
    return undefined
  }

  const field = stringOrVariable(
    valueNode.fields.find((f) => f?.name?.value === 'field')?.value,
    variables
  )
  const order = valueOrVariable(
    valueNode.fields.find((f) => f?.name?.value === 'order')?.value,
    variables
  )

  const sortOrder = (order && order.toLowerCase()) || 'desc'

  return {
    // @ts-ignore
    $field: field,
    $order: sortOrder,
  }
}
