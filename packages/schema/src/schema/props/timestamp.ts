import { assert, isNumber, isRecord, isString } from '../shared.js'
import { parseBase, type Base } from './base.js'
import { convertToTimestamp } from '@based/utils'

type Timestamp = number | Date | string

export type SchemaTimestamp<strict = false> = Base & {
  type: 'timestamp'
  on?: 'create' | 'update'
  min?: strict extends true ? number : Timestamp
  max?: strict extends true ? number : Timestamp
  default?: strict extends true ? number : Timestamp
  step?: strict extends true ? number : number | string
}

const isTimestamp = (v: unknown): v is Timestamp =>
  v instanceof Date || isNumber(v) || isString(v)

const convertToTsIfDefined = (v: Timestamp | undefined): number | undefined =>
  v === undefined ? v : convertToTimestamp(v)

export const parseTimestamp = (def: unknown): SchemaTimestamp<true> => {
  assert(isRecord(def))
  assert(def.type === 'timestamp')
  assert(def.on === undefined || def.on === 'create' || def.on === 'update')
  assert(def.min === undefined || isTimestamp(def.min))
  assert(def.max === undefined || isTimestamp(def.max))
  assert(def.step === undefined || isNumber(def.step) || isString(def.step))
  assert(def.default === undefined || isTimestamp(def.default))

  return parseBase<SchemaTimestamp<true>>(def, {
    type: def.type,
    on: def.on,
    min: convertToTsIfDefined(def.min),
    max: convertToTsIfDefined(def.max),
    step: convertToTsIfDefined(def.step),
    default: convertToTsIfDefined(def.default),
  })
}
