import { print, FieldNode } from 'graphql'

export function makeValue(graphqlAst: FieldNode): any {
  const arg = graphqlAst.arguments[0]?.value
  if (!arg || graphqlAst.arguments.length > 1) {
    throw new Error(
      `Too many arguments given to _value, should be 1 of type JSON`
    )
  }

  const serialized =
    arg.kind === 'ObjectValue'
      ? JSON.parse(
          print(arg).replace(/(['"])?([a-z0-9A-Z_]+)(['"])?:/g, '"$2": ')
        )
      : JSON.parse(print(arg))

  return { $value: serialized }
}
