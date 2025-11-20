import { parseSchema, type Schema } from './schema.ts'

export const parse = (input: Schema): { schema: Schema<true> } => {
  const schema = parseSchema(input)
  const defs = {}

  for (const type in schema.types) {
    const schemaType = schema.types[type]
    const tree = {}
    const def = { type }

    for (const prop in schemaType.props) {
      tree[prop] = {}
    }

    defs[type] = def
  }

  return { schema }
}
