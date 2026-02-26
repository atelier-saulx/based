import { assert, isString } from './shared.js'
import { parseString, type SchemaString } from './string.js'

export type SchemaAlias = Omit<SchemaString, 'type' | 'default'> & {
  type: 'alias'
  default?: string
}

export const parseAlias = (def: Record<string, unknown>): SchemaAlias => {
  def.type = 'string'
  assert(
    def.default === undefined || isString(def.default),
    'Default should be string',
  )
  const { type, ...rest } = parseString(def)
  return { type: 'alias', ...rest } as SchemaAlias
}
