import { assert, isRecord } from './shared.js'
import { parseBase, type Base } from './base.js'

export type SchemaJson = Base & {
  type: 'json'
  default?: any
}

export const parseJson = (def: Record<string, unknown>): SchemaJson =>
  parseBase<SchemaJson>(def, {
    type: 'json',
    default: def.default,
  })
