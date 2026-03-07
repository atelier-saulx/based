import { parseBase, type Base } from './base.js'
import { parseReference, type SchemaReference } from './reference.js'
import type { SchemaOut } from './schema.js'
import { assert, isNatural, isRecord, type RequiredIfStrict } from './shared.js'

export type SchemaReferences<strict = true, nested = false> = Base &
  RequiredIfStrict<{ type: 'references' }, strict> & {
    capped?: number
    items: Omit<SchemaReference<strict, nested>, keyof Base>
  }

export const parseReferences = (
  def: Record<string, unknown>,
  locales: SchemaOut['locales'],
): SchemaReferences => {
  assert(isRecord(def.items), 'Items should be record')
  assert(
    def.capped === undefined || isNatural(def.capped),
    'Capped should be a number',
  )
  return parseBase<SchemaReferences>(def, {
    type: 'references',
    capped: def.capped,
    items: parseReference(def.items, locales, true),
  })
}
