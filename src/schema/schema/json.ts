import { parseBase, type Base } from './base.js'
import { assert, isBoolean } from './shared.js'

export type SchemaJson = Base & {
  type: 'json'
  default?: any
  localized?: boolean
}

export const parseJson = (def: Record<string, unknown>): SchemaJson => {
  assert(
    def.localized === undefined || isBoolean(def.localized),
    'Invalid value for localized',
  )
  return parseBase<SchemaJson>(def, {
    type: 'json',
    default: def.default,
    localized: def.localized,
  })
}
