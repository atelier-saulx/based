import { assert, isRecord, isString } from '../shared.js'
import { parseBase, type Base } from './base.js'
import type { StringCompression, StringFormat } from './string.js'

export type SchemaText = Base & {
  type: 'text'
  default?: Record<string, string>
  format?: StringFormat
  compression?: StringCompression
}

const isText = (v: unknown): v is Record<string, string> =>
  isRecord(v) && Object.values(v).every(isString)

export const parseText = (def: unknown): SchemaText => {
  assert(isRecord(def))
  assert(def.type === 'text')
  assert(def.default === undefined || isText(def.default))

  return parseBase<SchemaText>(def, {
    type: def.type,
    default: def.default,
  })
}
