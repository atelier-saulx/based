import _default from '@based/hash/dist/src/crc32c.js'
import { ParseProp } from './index.js'
import {
  assert,
  isRecord,
  RequiredIfStrict,
  isString,
  isNatural,
  isEmpty,
} from './shared.js'
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

const isMime = (v: unknown): v is MimeString => isString(v) && v.includes('/')
const isStringFormat = (v: unknown): v is StringFormat =>
  (stringFormats as readonly unknown[]).includes(v)
const isCompression = (v: unknown): v is Compression =>
  (stringCompressions as readonly unknown[]).includes(v)

function assertMime(v: unknown): asserts v is Mime {
  if (v !== undefined) {
    if (Array.isArray(v)) {
      assert(v.every(isMime))
    } else {
      assert(isMime(v))
    }
  }
}

export type SchemaString<strict = true> =
  | (strict extends true ? never : 'string')
  | {
      type: RequiredIfStrict<'string', strict>
      default?: string
      maxBytes?: number
      min?: number
      max?: number
      mime?: Mime
      format?: StringFormat
      compression?: Compression
    }

export const parseString: ParseProp<SchemaString> = (
  def: unknown | SchemaString<false>,
) => {
  if (def === 'string') {
    return { type: 'string' }
  }

  assert(isRecord(def))

  const {
    type,
    default: default_,
    maxBytes,
    min,
    max,
    format,
    compression,
    mime,
    ...rest
  } = def

  assert(type === undefined || type === 'string')
  assert(isEmpty(rest))

  assert(compression === undefined || isCompression(compression))
  assert(format === undefined || isStringFormat(format))
  assert(maxBytes === undefined || isNatural(maxBytes))
  assert(default_ === undefined || isString(default_))
  assert(min === undefined || isNatural(min))
  assert(max === undefined || isNatural(max))
  assertMime(mime)

  return {
    type: 'string',
    default: default_,
    maxBytes,
    min,
    max,
    format,
    compression,
    mime,
  }
}
