import { parseBase, type Base } from './base.ts'
import { assert, isRecord, isString, type RequiredIfStrict } from './shared.ts'
import { parseProp, type SchemaProp } from './prop.ts'
import type { Schema } from './schema.ts'

export type SchemaReference<strict = false> = Base & {
  type: RequiredIfStrict<'reference', strict>
  ref: string
  prop: string
  [edge: `$${string}`]: SchemaProp<strict>
}

export const parseReference = (
  def: unknown,
  schema: Schema,
): SchemaReference<true> => {
  assert(isRecord(def))
  assert(def.type === undefined || def.type === 'reference')
  assert(isString(def.ref))
  assert(def.ref in schema.types)
  assert(isString(def.prop))
  assert(isRecord(schema.types[def.ref]))

  const result: SchemaReference<true> = {
    type: 'reference',
    ref: def.ref,
    prop: def.prop,
  }

  for (const key in def) {
    if (key.startsWith('$')) {
      result[key] = parseProp(result[key], schema)
    }
  }

  return parseBase<SchemaReference<true>>(def, result)
}
