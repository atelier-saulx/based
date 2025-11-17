import { parseBase, type Base } from './base.ts'
import { parseReference, type SchemaReference } from './reference.ts'
import { assert, isRecord, type RequiredIfStrict } from './shared.ts'

export type SchemaReferences<strict = true> = Base &
  RequiredIfStrict<{ type: 'references' }, strict> & {
    items: SchemaReference<strict>
  }

export const parseReferences = (def: unknown): SchemaReferences => {
  assert(isRecord(def))
  return parseBase<SchemaReferences>(def, {
    type: 'references',
    items: parseReference(def.items),
  })
}
