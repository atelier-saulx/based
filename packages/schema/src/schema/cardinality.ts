import { assert, isNatural, isRecord } from './shared.js'
import { parseBase, type Base } from './base.js'

export type SchemaCardinality = Base & {
  type: 'cardinality'
  maxBytes?: number
  precision?: number
  mode?: 'sparse' | 'dense'
}

export const parseCardinality = (
  def: Record<string, unknown>,
): SchemaCardinality => {
  assert(
    def.maxBytes === undefined || isNatural(def.maxBytes),
    'Max Bytes should be natural number',
  )
  assert(
    def.precision === undefined || isNatural(def.precision),
    'Precision should be natural number',
  )
  assert(
    def.mode === undefined || def.mode === 'sparse' || def.mode === 'dense',
    "Mode should be 'sparse' or 'dense'",
  )

  return parseBase<SchemaCardinality>(def, {
    type: 'cardinality',
    maxBytes: def.maxBytes,
    precision: def.precision,
    mode: def.mode,
  })
}
