import { FieldNode } from 'graphql'

export function makeInherit(graphqlAst: FieldNode) {
  if (!graphqlAst.arguments) {
    return { $inherit: true }
  }

  // @ts-ignore
  const types = graphqlAst.arguments[0]?.value?.values.map((e: any) => {
    return e.value
  })

  if (!types.length) {
    return { $inherit: true }
  }

  return { $inherit: { $type: types } }
}
