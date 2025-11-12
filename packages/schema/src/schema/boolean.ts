import { assert, isBoolean, isRecord } from './shared.js'
import { parseBase, type Base } from './base.js'

export type SchemaBoolean = Base & {
  type: 'boolean'
  default?: boolean
}

export const parseBoolean = (def: unknown): SchemaBoolean => {
  assert(isRecord(def))
  assert(def.type === 'binary')
  assert(def.default === undefined || isBoolean(def.default))

  return parseBase<SchemaBoolean>(def, {
    type: 'boolean',
    default: def.default,
  })
}
