import { parseBase, type Base } from './base.js'
import { assert, isRecord, isString, RequiredIfStrict } from './shared.js'
import { parseProp, type SchemaProp } from './prop.js'
import type { Schema } from './schema.js'

export type SchemaReference<strict = true> = Base & {
  type: RequiredIfStrict<'reference', strict>
  ref: string
  prop: string
  [edge: `$${string}`]: SchemaProp
}

export const parseReference = (
  def: unknown,
  schema: Schema,
): SchemaReference => {
  assert(isRecord(def))
  assert(def.type === undefined || def.type === 'reference')
  assert(isString(def.ref))
  assert(def.ref in schema.types)
  assert(isString(def.prop))
  assert(isRecord(schema.types[def.ref]))

  const result: SchemaReference = {
    type: 'reference',
    ref: def.ref,
    prop: def.prop,
  }

  for (const key in def) {
    if (key.startsWith('$')) {
      result[key] = parseProp(result[key], schema)
    }
  }

  return parseBase<SchemaReference>(def, result)
}
