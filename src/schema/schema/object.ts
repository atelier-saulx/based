import { assert, isRecord, type RequiredIfStrict } from './shared.js'
import { parseBase, type Base } from './base.js'
import { parseProp, type SchemaProp } from './prop.js'
import type { SchemaOut } from './schema.js'

export type SchemaObject<strict = false> = Base & {
  props: Record<string, SchemaProp<strict>>
} & RequiredIfStrict<{ type: 'object' }, strict>

export const parseObject = (
  def: Record<string, unknown>,
  locales: SchemaOut['locales'],
): SchemaObject<true> => {
  assert(isRecord(def.props), 'Props should be record')

  const props = {}
  for (const prop in def.props) {
    props[prop] = parseProp(def.props[prop], locales)
  }

  return parseBase<SchemaObject<true>>(def, {
    type: 'object',
    props,
  })
}
