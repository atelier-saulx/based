import { parseBase, type Base } from './base.js'
import { parseReference, type SchemaReference } from './reference.js'
import { assert, isRecord, type RequiredIfStrict } from './shared.js'

export type SchemaReferences<strict = true> = Base &
  RequiredIfStrict<{ type: 'references' }, strict> & {
    capped?: number
    items: SchemaReference<strict>
  }

export const parseReferences = (
  def: Record<string, unknown>,
): SchemaReferences => {
  assert(isRecord(def.items), 'Items should be record')
  return parseBase<SchemaReferences>(def, {
    type: 'references',
    items: parseReference(def.items),
  })
}
