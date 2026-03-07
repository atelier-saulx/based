import { parseBase, type Base } from './base.js'
import { assert, isNatural } from './shared.js'
import { isFormat, type StringFormat } from './string.js'

export type SchemaAlias = Base & {
  type: 'alias'
  maxBytes?: number
  min?: number
  max?: number
  format?: StringFormat
}

export const parseAlias = (def: Record<string, unknown>): SchemaAlias => {
  assert(
    def.maxBytes === undefined || isNatural(def.maxBytes),
    'Max bytes should be natural number',
  )
  assert(
    def.min === undefined || isNatural(def.min),
    'Min should be natural number',
  )
  assert(
    def.max === undefined || isNatural(def.max),
    'Max should be natural number',
  )
  assert(def.format === undefined || isFormat(def.format), 'Invalid format')

  return parseBase<SchemaAlias>(def, {
    type: 'alias',
    maxBytes: def.maxBytes,
    min: def.min,
    max: def.max,
    format: def.format,
  })
}
