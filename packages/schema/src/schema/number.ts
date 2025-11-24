import { assert, isNumber, isString } from './shared.js'
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

export const parseNumber = (def: Record<string, unknown>): SchemaNumber => {
  assert(isNumberType(def.type), `Type should be one of ${numberTypes}`)
  assert(
    def.default === undefined || isNumber(def.default),
    'Default should be number',
  )
  assert(def.min === undefined || isNumber(def.min), 'Min should be number')
  assert(def.max === undefined || isNumber(def.max), 'Max should be number')
  assert(def.step === undefined || isNumber(def.step), 'Step should be number')

  return parseBase<SchemaNumber>(def, {
    type: def.type,
    default: def.default,
    min: def.min,
    max: def.max,
    step: def.step,
  })
}
