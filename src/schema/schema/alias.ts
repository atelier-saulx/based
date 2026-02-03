import { assert } from './shared.js'
import { parseString, type SchemaString } from './string.js'

export type SchemaAlias = Omit<SchemaString, 'type' | 'default'> & {
  type: 'alias'
  default?: never
}

export const parseAlias = (def: Record<string, unknown>): SchemaAlias => {
  def.type = 'string'
  assert(def.default === undefined, 'Default alias not allowed')
  const { type, ...rest } = parseString(def)
  return { type: 'alias', ...rest } as SchemaAlias
}
