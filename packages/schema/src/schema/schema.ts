import assert from 'assert'
import { isRecord } from './shared.js'
import { parseType, type SchemaType } from './type.js'

type SchemaTypes<strict = true> = Record<string, SchemaType<strict>>

export type Schema<strict = false> = {
  types: SchemaTypes<strict>
}

export const parseSchema = (schema: Schema): Schema<true> => {
  assert(isRecord(schema?.types))
  const types: SchemaTypes<true> = {}
  for (const key in types) {
    types[key] = parseType(schema.types[key], schema)
  }
  return {
    types,
  }
}
