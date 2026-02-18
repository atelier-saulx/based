import { assert, isBoolean, isNumber, isRecord, isString } from './shared.js'
import { parseBase, type Base } from './base.js'
import { convertToTimestamp } from '../../utils/index.js'

type Timestamp = number | Date | string

export type SchemaTimestamp<strict = false> = Base & {
  type: 'timestamp'
  on?: 'create' | 'update'
  min?: strict extends true ? number : Timestamp
  max?: strict extends true ? number : Timestamp
  default?: strict extends true ? number : Timestamp
  step?: strict extends true ? number : number | string
  expire?: boolean
}

export const isTimestamp = (v: unknown): v is Timestamp =>
  v instanceof Date || isNumber(v) || isString(v)

const convertToTsIfDefined = (v: Timestamp | undefined): number | undefined =>
  v === undefined ? v : convertToTimestamp(v)

export const parseTimestamp = (
  def: Record<string, unknown>,
): SchemaTimestamp<true> => {
  assert(
    def.on === undefined || def.on === 'create' || def.on === 'update',
    "On should be one of 'create' or 'update",
  )
  assert(def.min === undefined || isTimestamp(def.min), 'Invalid timestamp')
  assert(def.max === undefined || isTimestamp(def.max), 'Invalid max timestamp')
  assert(
    def.step === undefined || isNumber(def.step) || isString(def.step),
    'Invalid step',
  )
  assert(
    def.default === undefined || isTimestamp(def.default),
    'Invalid default timestamp',
  )

  assert(
    def.expire === undefined || isBoolean(def.expire),
    'Invalid expire timestamp',
  )

  return parseBase<SchemaTimestamp<true>>(def, {
    type: 'timestamp',
    on: def.on,
    expire: def.expire,
    min: convertToTsIfDefined(def.min),
    max: convertToTsIfDefined(def.max),
    step: convertToTsIfDefined(def.step),
    default: convertToTsIfDefined(def.default),
  })
}
