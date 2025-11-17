import { parseBase, type Base } from './base.ts'
import { assert, isRecord, isString, type RequiredIfStrict } from './shared.ts'
import { parseProp, type SchemaProp } from './prop.ts'

export type SchemaReference<strict = false> = Base & {
  ref: string
  prop: string
  [edge: `$${string}`]: SchemaProp<strict>
} & RequiredIfStrict<{ type: 'reference' }, strict>

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
      result[key] = parseProp(result[key])
    }
  }

  return parseBase<SchemaReference<true>>(def, result)
}
