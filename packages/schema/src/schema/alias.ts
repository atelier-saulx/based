import { parseString, type SchemaString } from './string.js'

export type SchemaAlias = Omit<SchemaString, 'type'> & {
  type: 'alias'
}

export const parseAlias = (def: Record<string, unknown>): SchemaAlias => {
  def.type = 'string'
  const { type, ...rest } = parseString(def)
  return { type: 'alias', ...rest }
}
