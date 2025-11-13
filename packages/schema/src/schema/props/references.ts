import { parseBase, type Base } from './base.js'
import { parseReference, type SchemaReference } from './reference.js'
import { assert, isRecord, type RequiredIfStrict } from '../shared.js'
import type { Schema } from '../index.js'

export type SchemaReferences<strict = true> = Base & {
  type: RequiredIfStrict<'references', strict>
  items: SchemaReference<strict>
}

export const parseReferences = (
  def: unknown,
  schema: Schema,
): SchemaReferences => {
  assert(isRecord(def))
  return parseBase<SchemaReferences>(def, {
    type: 'references',
    items: parseReference(def.items, schema),
  })
}
