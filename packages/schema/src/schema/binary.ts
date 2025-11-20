import { isFormat, isMime, type Mime, type StringFormat } from './string.js'
import { assert, isNatural, isRecord } from './shared.js'
import { parseBase, type Base } from './base.js'

export type SchemaBinary = Base & {
  type: 'binary'
  default?: Uint8Array
  maxBytes?: number
  mime?: Mime
  format?: StringFormat
}

export const parseBinary = (def: unknown): SchemaBinary => {
  assert(isRecord(def))
  assert(def.type === 'binary')
  assert(def.default === undefined || def.default instanceof Uint8Array)
  assert(def.maxBytes === undefined || isNatural(def.maxBytes))
  assert(def.mime === undefined || isMime(def.mime))
  assert(def.format === undefined || isFormat(def.format))

  return parseBase<SchemaBinary>(def, {
    type: 'binary',
    default: def.default,
    maxBytes: def.maxBytes,
    mime: def.mime,
    format: def.format,
  })
}
