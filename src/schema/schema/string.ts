import { isString, isNatural, assert, isBoolean, isRecord } from './shared.js'
import { parseBase, type Base } from './base.js'
import v from 'validator'
import type { SchemaOut } from './schema.js'

const validators = {
  email: v.isEmail,
  URL: v.isURL,
  MACAddress: v.isMACAddress,
  IP: v.isIP,
  IPRange: v.isIPRange,
  FQDN: v.isFQDN,
  IBAN: v.isIBAN,
  BIC: v.isBIC,
  alpha: v.isAlpha,
  alphaLocales: v.isAlphaLocales,
  alphanumeric: v.isAlphanumeric,
  alphanumericLocales: v.isAlphanumericLocales,
  passportNumber: v.isPassportNumber,
  port: v.isPort,
  lowercase: v.isLowercase,
  uppercase: v.isUppercase,
  ascii: v.isAscii,
  semVer: v.isSemVer,
  surrogatePair: v.isSurrogatePair,
  IMEI: v.isIMEI,
  hexadecimal: v.isHexadecimal,
  octal: v.isOctal,
  hexColor: v.isHexColor,
  rgbColor: v.isRgbColor,
  HSL: v.isHSL,
  ISRC: v.isISRC,
  MD5: v.isMD5,
  JWT: v.isJWT,
  UUID: v.isUUID,
  luhnNumber: v.isLuhnNumber,
  creditCard: v.isCreditCard,
  identityCard: v.isIdentityCard,
  EAN: v.isEAN,
  ISIN: v.isISIN,
  ISBN: v.isISBN,
  ISSN: v.isISSN,
  mobilePhone: v.isMobilePhone,
  mobilePhoneLocales: v.isMobilePhoneLocales,
  postalCode: v.isPostalCode,
  postalCodeLocales: v.isPostalCodeLocales,
  ethereumAddress: v.isEthereumAddress,
  currency: v.isCurrency,
  btcAddress: v.isBtcAddress,
  ISO6391: v.isISO6391,
  ISO8601: v.isISO8601,
  RFC3339: v.isRFC3339,
  ISO31661Alpha2: v.isISO31661Alpha2,
  ISO31661Alpha3: v.isISO31661Alpha3,
  ISO4217: v.isISO4217,
  base32: v.isBase32,
  base58: v.isBase58,
  base64: v.isBase64,
  dataURI: v.isDataURI,
  magnetURI: v.isMagnetURI,
  mimeType: v.isMimeType,
  latLong: v.isLatLong,
  slug: v.isSlug,
  password: v.isStrongPassword,
  taxID: v.isTaxID,
  licensePlate: v.isLicensePlate,
  VAT: v.isVAT,
  code: () => true,
  javascript: () => true,
  typescript: () => true,
  python: () => true,
  rust: () => true,
  css: () => true,
  html: () => true,
  json: () => true,
  markdown: () => true,
  clike: () => true,
} as const

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
  maxBytes?: number
  min?: number
  max?: number
  mime?: Mime
  format?: StringFormat
  compression?: StringCompression
} & (
    | {
        localized?: false
        default?: string
      }
    | {
        localized: true
        default?: Record<string, string>
      }
  )

const isLocalized = (
  val: unknown,
  locales: SchemaOut['locales'] = {},
): val is Record<string, string> =>
  isRecord(val) &&
  Object.entries(val).every(([key, val]) => key in locales && isString(val))

export const parseString = (
  def: Record<string, unknown>,
  locales: SchemaOut['locales'],
): SchemaString => {
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
  assert(
    def.localized === undefined || isBoolean(def.localized),
    'Invalid localized',
  )

  if (def.localized) {
    assert(
      isRecord(locales) && Object.keys(locales).length > 0,
      'Locales should be defined',
    )
    assert(
      def.default === undefined || isLocalized(def.default, locales),
      'Default should be record of strings',
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
      localized: def.localized,
    })
  }
  assert(
    def.default === undefined || isString(def.default),
    'Default should be string',
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
