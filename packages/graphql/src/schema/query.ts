export default function generateQuery(schema: any): string {
  let def = 'type Query {\n'
  def += ' node(id: ID): Node\n'
  def += ' root: Root\n'
  def += ` observeFn(name: String!, payload: JSON): JSON`

  for (const typeName in schema.types) {
    const gqlName = typeName[0].toUpperCase() + typeName.slice(1)
    def += ` ${typeName}(id: ID): ${gqlName}\n`
  }

  // Disabling because names might not match gql naming convention and then
  // it's a mess. Functions just get called with `callFn`

  // for (const name in fns) {
  //   const fn = fns[name]

  //   if (fn.observable && !schema.types[name]) {
  //     def += `  ${name}(payload: JSON): JSON`
  //   }
  // }

  def += '\n'
  def += '}\n'

  return def
}
