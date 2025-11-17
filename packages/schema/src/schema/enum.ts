import {
  assert,
  isBoolean,
  isNumber,
  isRecord,
  isString,
  type RequiredIfStrict,
} from './shared.ts'
import { parseBase, type Base } from './base.ts'

type EnumItem = string | number | boolean

export type SchemaEnum<strict = false> = Base & {
  type: RequiredIfStrict<'enum', strict>
  default?: EnumItem
  enum: EnumItem[]
}

const isEnumItem = (v: unknown): v is EnumItem =>
  isString(v) || isNumber(v) || isBoolean(v)

export const parseEnum = (def: unknown): SchemaEnum<true> => {
  assert(isRecord(def))
  assert(def.type === 'enum')
  assert(def.default === undefined || isEnumItem(def.default))
  assert(Array.isArray(def.enum) && def.enum.every(isEnumItem))

  return parseBase<SchemaEnum<true>>(def, {
    type: 'enum',
    default: def.default,
    enum: def.enum,
  })
}
