import { parseBase, type Base } from './base.ts'
import { assert, isRecord, isString, type RequiredIfStrict } from './shared.ts'
import { parseProp, type SchemaProp } from './prop.ts'
import type { SchemaReferences } from './references.ts'

export type SchemaReference<strict = false> = Base &
  RequiredIfStrict<{ type: 'reference' }, strict> & {
    ref: string
  } & {
    prop: string
    [edge: `$${string}`]:
      | Exclude<SchemaProp<strict>, SchemaReferences<strict>>
      | (Omit<SchemaReferences<strict>, 'items'> & {
          items: Omit<SchemaReference<strict>, 'prop' | `$${string}`>
        })
  }

export const parseReference = (def: unknown): SchemaReference<true> => {
  assert(isRecord(def))
  assert(def.type === undefined || def.type === 'reference')
  assert(isString(def.ref))
  assert(isString(def.prop))

  const result: SchemaReference<true> = {
    type: 'reference',
    ref: def.ref,
    prop: def.prop,
  }

  for (const key in def) {
    if (key.startsWith('$')) {
      result[key] = parseProp(def[key])
    }
  }

  return parseBase<SchemaReference<true>>(def, result)
}
