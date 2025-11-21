import { parseBase, type Base } from './base.js'
import { assert, isRecord, isString, type RequiredIfStrict } from './shared.js'
import { parseProp, type SchemaProp } from './prop.js'
import type { SchemaReferences } from './references.js'

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
export const parseReference = (
  def: Record<string, unknown>,
): SchemaReference<true> => {
  assert(isString(def.ref), 'Ref should be string')

  if (parsingEdges) {
    return parseBase<SchemaReference<true>>(def, {
      type: 'reference',
      ref: def.ref,
    } as SchemaReference<true>)
  }

  assert(isString(def.prop), 'Prop should be string')

  const result: SchemaReference<true> = {
    type: 'reference',
    ref: def.ref,
    prop: def.prop,
  }

  parsingEdges = true
  for (const key in def) {
    if (key.startsWith('$')) {
      result[key] = parseProp(def, key)
    }
  }
  parsingEdges = false

  return parseBase<SchemaReference<true>>(def, result)
}
