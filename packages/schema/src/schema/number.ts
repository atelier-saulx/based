import { assert, isNatural, isNumber, isRecord, isString } from './shared.js'
import { parseBase, type Base } from './base.js'

export const numberTypes = [
  'number',
  'int8',
  'uint8',
  'int16',
  'uint16',
  'int32',
  'uint32',
]

export type NumberType = (typeof numberTypes)[number]

export type SchemaNumber = Base & {
  type: NumberType
  default?: number
  min?: number
  max?: number
  step?: number
}

export const parseNumber = (def: unknown): SchemaNumber => {
  assert(isRecord(def))
  assert(isString(def.type) && numberTypes.includes(def.type))
  assert(def.default === undefined || isNumber(def.default))
  assert(def.min === undefined || isNumber(def.min))
  assert(def.max === undefined || isNumber(def.max))
  assert(def.step === undefined || isNumber(def.step))

  return parseBase<SchemaNumber>(def, {
    type: def.type,
    default: def.default,
    min: def.min,
    max: def.max,
    step: def.step,
  })
}
