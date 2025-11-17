import { parseBase, type Base } from './base.ts'
import { parseReference, type SchemaReference } from './reference.ts'
import { assert, isRecord, type RequiredIfStrict } from './shared.ts'
import type { Schema } from './schema.ts'

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
