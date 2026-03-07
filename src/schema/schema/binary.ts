import { isFormat, isMime, type Mime, type StringFormat } from './string.js'
import { assert, isNatural } from './shared.js'
import { parseBase, type Base } from './base.js'

export type SchemaBinary = Base & {
  type: 'binary'
  default?: Uint8Array
  maxBytes?: number
  mime?: Mime
  format?: StringFormat
}

export const parseBinary = (def: Record<string, unknown>): SchemaBinary => {
  assert(
    def.default === undefined || def.default instanceof Uint8Array,
    'Default should be Uint8Array',
  )
  assert(
    def.maxBytes === undefined || isNatural(def.maxBytes),
    'Max Bytes should be a natural number',
  )
  assert(def.mime === undefined || isMime(def.mime), 'Invalid mime')
  assert(def.format === undefined || isFormat(def.format), 'Invalid format')

  return parseBase<SchemaBinary>(def, {
    type: 'binary',
    default: def.default,
    maxBytes: def.maxBytes,
    mime: def.mime,
    format: def.format,
  })
}
