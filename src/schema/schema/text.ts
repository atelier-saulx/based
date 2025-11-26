import { parseBase, type Base } from './base.js'
import type { SchemaOut } from './schema.js'
import { assert, isRecord, isString } from './shared.js'
import {
  isCompression,
  isFormat,
  stringCompressions,
  stringFormats,
  type StringCompression,
  type StringFormat,
} from './string.js'

export type SchemaText = Base & {
  type: 'text'
  default?: Record<string, string>
  format?: StringFormat
  compression?: StringCompression
}

export const parseText = (
  def: Record<string, unknown>,
  locales: SchemaOut['locales'],
): SchemaText => {
  assert(
    isRecord(locales) && Object.keys(locales).length > 0,
    'Locales should be defined',
  )
  assert(
    def.compression === undefined || isCompression(def.compression),
    `Compression should be one of ${stringCompressions.join(', ')}`,
  )
  assert(
    def.format === undefined || isFormat(def.format),
    `Format should be one of ${stringFormats.join(', ')}`,
  )
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
    compression: def.compression,
    format: def.format,
  })
}
