import { parseBase } from './base.js'
import type { SchemaString } from './string.js'

export type SchemaJson = Omit<SchemaString, 'default' | 'type'> & {
  type: 'json'
  default?: any
}

export const parseJson = (def: Record<string, unknown>): SchemaJson =>
  parseBase<SchemaJson>(def, {
    type: 'json',
    default: def.default,
  })
