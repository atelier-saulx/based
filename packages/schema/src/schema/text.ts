import { parseBase, type Base } from './base.js'
import { assert, isRecord, isString } from './shared.js'
import type { StringCompression, StringFormat } from './string.js'

export type SchemaText = Base & {
  type: 'text'
  default?: Record<string, string>
  format?: StringFormat
  compression?: StringCompression
}

export const parseText = (def: Record<string, unknown>): SchemaText => {
  if (def.default) {
    assert(isRecord(def.default), 'Default should be record of strings')
    assert(
      Object.values(def.default).every(isString),
      'Default should be record of strings',
    )
  }

  return parseBase<SchemaText>(def, {
    type: 'text',
    default: def.default as SchemaText['default'],
  })
}
