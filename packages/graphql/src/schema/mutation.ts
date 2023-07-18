import generateDelete from './delete'

export default function generateMutations(schema: any, fns: any = {}): string {
  let def = 'type Mutation {\n'

  def += `  setRoot(input: RootInput): Root`
  def += '\n'

  def += `  callFn(name: String!, payload: JSON): JSON`
  def += '\n'

  for (let typeName in schema.types) {
    typeName = typeName[0].toUpperCase() + typeName.slice(1)
    const inputType = `${typeName}Input`
    def += `  set${typeName}(id: ID, input: ${inputType}): ${typeName}`
    def += '\n'

    def += `  create${typeName}(input: ${inputType}): ${typeName}`
    def += '\n'
    def += '\n'
  }

  for (const name in fns) {
    const fn = fns[name]

    if (!fn.observable) {
      def += `  ${name}(payload: JSON): JSON`
    }
  }

  def += generateDelete()

  def += '}\n\n'

  return def
}
