import { assert, isRecord, type RequiredIfStrict } from './shared.js'
import { parseBase, type Base } from './base.js'
import { parseProp, type SchemaProp } from './prop.js'

export type SchemaObject<strict = false> = Base & {
  props: Record<string, SchemaProp<strict>>
} & RequiredIfStrict<{ type: 'object' }, strict>

export const parseObject = (def: unknown): SchemaObject<true> => {
  assert(isRecord(def))
  assert(def.type === undefined || def.type === 'object')
  assert(isRecord(def.props))

  const props = {}
  for (const prop in def.props) {
    props[prop] = parseProp(def.props[prop])
  }

  return parseBase<SchemaObject<true>>(def, {
    type: 'object',
    props,
  })
}
