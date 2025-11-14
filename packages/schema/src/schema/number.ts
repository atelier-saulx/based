import { assert, isNumber, isRecord, isString } from './shared.js'
import { parseBase, type Base } from './base.js'

export const numberTypes = [
  'number',
  'int8',
  'uint8',
  'int16',
  'uint16',
  'int32',
  'uint32',
] as const

export type NumberType = (typeof numberTypes)[number]

export type SchemaNumber = Base & {
  type: NumberType
  default?: number
  min?: number
  max?: number
  step?: number
}

const isNumberType = (v: unknown): v is NumberType =>
  isString(v) && numberTypes.includes(v as NumberType)

export const parseNumber = (def: unknown): SchemaNumber => {
  assert(isRecord(def))
  assert(isNumberType(def.type))
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
