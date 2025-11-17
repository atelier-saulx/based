import { isString, isNatural, isRecord, assert } from './shared.ts'
import { parseBase, type Base } from './base.ts'

export const stringFormats = [
  'alpha',
  'alphaLocales',
  'alphanumeric',
  'alphanumericLocales',
  'ascii',
  'base32',
  'base58',
  'base64',
  'BIC',
  'btcAddress',
  'clike',
  'code',
  'creditCard',
  'css',
  'currency',
  'dataURI',
  'EAN',
  'email',
  'ethereumAddress',
  'FQDN',
  'hexadecimal',
  'hexColor',
  'HSL',
  'html',
  'IBAN',
  'identityCard',
  'IMEI',
  'IP',
  'IPRange',
  'ISBN',
  'ISIN',
  'ISO31661Alpha2',
  'ISO31661Alpha3',
  'ISO4217',
  'ISO6391',
  'ISO8601',
  'ISRC',
  'ISSN',
  'javascript',
  'json',
  'JWT',
  'latLong',
  'licensePlate',
  'lowercase',
  'luhnNumber',
  'MACAddress',
  'magnetURI',
  'markdown',
  'MD5',
  'mimeType',
  'mobilePhone',
  'mobilePhoneLocales',
  'octal',
  'password',
  'passportNumber',
  'port',
  'postalCode',
  'postalCodeLocales',
  'python',
  'RFC3339',
  'rgbColor',
  'rust',
  'semVer',
  'slug',
  'surrogatePair',
  'taxID',
  'typescript',
  'uppercase',
  'URL',
  'UUID',
  'VAT',
] as const
export const stringCompressions = ['none', 'deflate']

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

export type StringFormat = (typeof stringFormats)[number]
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

export const parseString = (def: unknown): SchemaString => {
  assert(isRecord(def))
  assert(def.type === 'string')
  assert(def.default === undefined || isString(def.default))
  assert(def.maxBytes === undefined || isNatural(def.maxBytes))
  assert(def.min === undefined || isNatural(def.min))
  assert(def.max === undefined || isNatural(def.max))
  assert(def.mime === undefined || isMime(def.mime))
  assert(def.format === undefined || isFormat(def.format))
  assert(def.compression === undefined || isCompression(def.compression))

  return parseBase<SchemaString>(def, {
    type: def.type,
    default: def.default,
    maxBytes: def.maxBytes,
    min: def.min,
    max: def.max,
    mime: def.mime,
    format: def.format,
    compression: def.compression,
  })
}
