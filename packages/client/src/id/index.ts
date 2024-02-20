import { BasedSchema } from '@based/schema'
import { SELVA_NODE_ID_LEN } from '../protocol/index.js'
import { v4 as uuid } from 'uuid'

function getIdPrefix(schema: BasedSchema, type: string): string {
  const typeSchema = schema.types[type]
  if (!typeSchema) {
    throw new Error(`Type ${type} does not exist`)
  }

  return typeSchema.prefix
}

export default function genId(schema: BasedSchema, type: string): string {
  const prefix = getIdPrefix(schema, type)
  return (
    prefix +
    uuid()
      .replaceAll('-', '')
      .substring(0, SELVA_NODE_ID_LEN - prefix.length)
  )
}
