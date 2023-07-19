import generateDelete from './delete'

export default function generateMutations(schema: any): string {
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

  // Disabling because names might not match gql naming convention and then
  // it's a mess. Functions just get called with `callFn`

  // for (const fn of fns) {
  //   const {
  //     name,
  //     config: { type },
  //   } = fn

  //   if (type === 'function') {
  //       def += `  ${name}(payload: JSON): JSON`
  //     }
  //   }
  // }

  def += generateDelete()

  def += '}\n\n'

  return def
}
