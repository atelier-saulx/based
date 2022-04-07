import { FunctionConfig, Schema } from '@based/types'

export default function generateQuery(
  schema: Schema,
  fns: FunctionConfig = {}
): string {
  let def = 'type Query {\n'
  def += ' node(id: ID): Node\n'
  def += ' root: Root\n'
  def += ` observeFn(name: String!, payload: JSON): JSON`

  for (const typeName in schema.types) {
    const gqlName = typeName[0].toUpperCase() + typeName.slice(1)
    def += ` ${typeName}(id: ID): ${gqlName}\n`
  }

  for (const name in fns) {
    const fn = fns[name]

    if (fn.observable && !schema.types[name]) {
      def += `  ${name}(payload: JSON): JSON`
    }
  }

  def += '\n'
  def += '}\n'

  return def
}
