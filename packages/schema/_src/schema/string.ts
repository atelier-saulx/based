import type { Schema } from './index.js'
import { isString, isNatural, getValidate } from './shared.js'
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

type StringFormat = (typeof stringFormats)[number]
type Compression = (typeof stringCompressions)[number]
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
type Mime = MimeString | MimeString[]

const isMimeString = (v: unknown): v is MimeString =>
  isString(v) && v.includes('/')

type SchemaStringObj = {
  type: 'string'
  default?: string
  maxBytes?: number
  min?: number
  max?: number
  mime?: Mime
  format?: StringFormat
  compression?: Compression
}

export type SchemaString<strict = true> = strict extends true
  ? SchemaStringObj
  : 'string' | SchemaStringObj

const validate = getValidate<SchemaStringObj, SchemaString<true>>(
  {
    type: 'string',
  },
  {
    default: isString,
    maxBytes: isNatural,
    min: isNatural,
    max: isNatural,
    mime: (v) => (Array.isArray(v) ? v.every(isMimeString) : isMimeString(v)),
    format: (v) => stringCompressions.includes(v as any),
    compression: (v) => stringCompressions.includes(v as any),
  },
)

export const parseString = (def: unknown, schema: Schema): SchemaString => {
  if (def === 'string') {
    return { type: 'string' }
  }
  return validate(def)
}
