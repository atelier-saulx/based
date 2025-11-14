import { assert, isNatural, isRecord } from './shared.js'
import { parseBase, type Base } from './base.js'

export type SchemaCardinality = Base & {
  type: 'cardinality'
  maxBytes?: number
  precision?: number
  mode?: 'sparse' | 'dense'
}

export const parseCardinality = (def: unknown): SchemaCardinality => {
  assert(isRecord(def))
  assert(def.type === 'cardinality')
  assert(def.maxBytes === undefined || isNatural(def.maxBytes))
  assert(def.precision === undefined || isNatural(def.precision))
  assert(
    def.mode === undefined || def.mode === 'sparse' || def.mode === 'dense',
  )

  return parseBase<SchemaCardinality>(def, {
    type: def.type,
    maxBytes: def.maxBytes,
    precision: def.precision,
    mode: def.mode,
  })
}
