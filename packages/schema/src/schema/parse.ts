import { parseSchema, type Schema } from './schema.js'

export const parse = (schema: Schema): { schema: Schema<true> } => ({
  schema: parseSchema(schema),
})
