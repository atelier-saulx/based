import { isString, isNatural, isRecord, assert } from './shared.js'
import { parseBase, type Base } from './base.js'
import { validators } from '../def/validation.js'

export type StringFormat = keyof typeof validators

export const stringFormats = Object.keys(validators) as StringFormat[]
export const stringCompressions = ['none', 'deflate'] as const

export type StringCompression = (typeof stringCompressions)[number]
type KnownMimeTypes =
  | 'text/html'
  | 'text/plain'
  | 'text/markdown'
  | 'image/png'
  | 'image/jpeg'
  | 'video/mp4'
  | 'video/quicktime'
  | 'image/*'
  | 'video/*'
  | 'audio/*'
  | '*/*'

type GeneralMimeType = `${string}/${string}`
type MimeString = KnownMimeTypes | (GeneralMimeType & {})

export type Mime = MimeString | MimeString[]

const isMimeString = (v: unknown): v is MimeString =>
  isString(v) && v.includes('/')

export const isMime = (v: unknown): v is Mime =>
  Array.isArray(v) ? v.every(isMimeString) : isMimeString(v)

export const isFormat = (v: unknown): v is StringFormat =>
  stringFormats.includes(v as any)

export const isCompression = (v: unknown): v is StringCompression =>
  stringCompressions.includes(v as any)

export type SchemaString = Base & {
  type: 'string'
  default?: string
  maxBytes?: number
  min?: number
  max?: number
  mime?: Mime
  format?: StringFormat
  compression?: StringCompression
}

export const parseString = (def: Record<string, unknown>): SchemaString => {
  assert(
    def.default === undefined || isString(def.default),
    'Default should be string',
  )
  assert(
    def.maxBytes === undefined || isNatural(def.maxBytes),
    'Max bytes should be natural number',
  )
  assert(
    def.min === undefined || isNatural(def.min),
    'Min should be natural number',
  )
  assert(
    def.max === undefined || isNatural(def.max),
    'Max should be natural number',
  )
  assert(def.mime === undefined || isMime(def.mime), 'Invalid mime')
  assert(def.format === undefined || isFormat(def.format), 'Invalid format')
  assert(
    def.compression === undefined || isCompression(def.compression),
    'Invalid compression',
  )

  return parseBase<SchemaString>(def, {
    type: 'string',
    default: def.default,
    maxBytes: def.maxBytes,
    min: def.min,
    max: def.max,
    mime: def.mime,
    format: def.format,
    compression: def.compression,
  })
}
