import { parseBase, type Base } from './base.js'
import type { StringCompression, StringFormat } from './string.js'

export type SchemaText = Base & {
  type: 'text'
  // default?: Record<string, string>
  format?: StringFormat
  compression?: StringCompression
}

export const parseText = (def: Record<string, unknown>): SchemaText => {
  return parseBase<SchemaText>(def, {
    type: 'text',
    // default: def.default
  })
}
