import { assert, isBoolean, isRecord } from './shared.js'
import { parseBase, type Base } from './base.js'

export type SchemaBoolean = Base & {
  type: 'boolean'
  default?: boolean
}

export const parseBoolean = (def: Record<string, unknown>): SchemaBoolean => {
  assert(
    def.default === undefined || isBoolean(def.default),
    'Default should be boolean',
  )

  return parseBase<SchemaBoolean>(def, {
    type: 'boolean',
    default: def.default,
  })
}
