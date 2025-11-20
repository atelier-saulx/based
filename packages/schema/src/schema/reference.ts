import { parseBase, type Base } from './base.ts'
import { assert, isRecord, isString, type RequiredIfStrict } from './shared.ts'
import { parseProp, type SchemaProp } from './prop.ts'
import type { SchemaReferences } from './references.ts'

type EdgeExcludedProps = 'prop' | `$${string}`

export type SchemaReference<strict = false> = Base &
  RequiredIfStrict<{ type: 'reference' }, strict> & {
    ref: string
  } & {
    prop: string
    [edge: `$${string}`]:
      | Exclude<SchemaProp<strict>, SchemaReferences<strict>>
      | (Omit<SchemaReferences<strict>, 'items'> & {
          items: Omit<SchemaReference<strict>, EdgeExcludedProps>
        })
  }

let parsingEdges: boolean
export const parseReference = (def: unknown): SchemaReference<true> => {
  assert(isRecord(def))
  assert(def.type === undefined || def.type === 'reference')
  assert(isString(def.ref))

  if (parsingEdges) {
    return parseBase<Omit<SchemaReference<true>, EdgeExcludedProps>>(def, {
      type: 'reference',
      ref: def.ref,
    }) as SchemaReference<true>
  }

  assert(isString(def.prop))

  const result: SchemaReference<true> = {
    type: 'reference',
    ref: def.ref,
    prop: def.prop,
  }

  parsingEdges = true
  for (const key in def) {
    if (key.startsWith('$')) {
      result[key] = parseProp(def[key])
    }
  }
  parsingEdges = false

  return parseBase<SchemaReference<true>>(def, result)
}
