import { assert, isRecord, type RequiredIfStrict } from './shared.ts'
import { parseBase, type Base } from './base.ts'
import { parseProp, type SchemaProp } from './prop.ts'
import type { Schema } from './schema.ts'

export type SchemaObject<strict = false> = Base & {
  type: RequiredIfStrict<'object', strict>
  props: Record<string, SchemaProp>
}

export const parseObject = (
  def: unknown,
  schema: Schema,
): SchemaObject<true> => {
  assert(isRecord(def))
  assert(def.type === 'object')
  assert(isRecord(def.props))

  const props = {}
  for (const prop in def.props) {
    props[prop] = parseProp(def.props[prop], schema)
  }

  return parseBase<SchemaObject<true>>(def, {
    type: 'object',
    props,
  })
}
