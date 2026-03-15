import {
  assert,
  isBoolean,
  isNumber,
  isString,
  type RequiredIfStrict,
} from './shared.js'
import { parseBase, type Base } from './base.js'

export type EnumItem = string | number
export type SchemaEnum<strict = false> = Base &
  RequiredIfStrict<{ type: 'enum' }, strict> & {
    default?: EnumItem
    enum: EnumItem[] | readonly EnumItem[]
  }

const isEnumItem = (v: unknown): v is EnumItem =>
  isString(v) || isNumber(v) || isBoolean(v)

export const parseEnum = (def: Record<string, unknown>): SchemaEnum<true> => {
  assert(
    def.default === undefined || isEnumItem(def.default),
    'Default should be valid enum',
  )
  assert(Array.isArray(def.enum) && def.enum.every(isEnumItem), 'Invalid enum')

  return parseBase<SchemaEnum<true>>(def, {
    type: 'enum',
    default: def.default,
    enum: def.enum,
  })
}
