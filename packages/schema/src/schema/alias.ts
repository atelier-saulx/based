import { assert, isRecord } from './shared.ts'
import { parseString, type SchemaString } from './string.ts'

export type SchemaAlias = Omit<SchemaString, 'type'> & {
  type: 'alias'
}

export const parseAlias = (def: unknown): SchemaAlias => {
  assert(isRecord(def))
  def.type = 'string'
  const { type, ...rest } = parseString(def)
  return { type: 'alias', ...rest }
}
