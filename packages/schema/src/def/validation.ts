import { convertToTimestamp } from '@based/utils'
import {
  TypeIndex,
  PropDef,
  PropDefEdge,
  ALIAS,
  BINARY,
  JSON,
  BOOLEAN,
  CARDINALITY,
  TIMESTAMP,
  INT16,
  INT32,
  INT8,
  UINT8,
  UINT16,
  UINT32,
  NUMBER,
  ENUM,
  ID,
  MICRO_BUFFER,
  REFERENCE,
  REFERENCES,
  STRING,
  TEXT,
  ALIASES,
  VECTOR,
  COLVEC,
  NULL,
  OBJECT,
} from './types.js'
import {
  MAX_ID,
  MIN_ID,
  SchemaEnum,
  SchemaNumber,
  SchemaProp,
  SchemaString,
  SchemaTimestamp,
  StrictSchema,
} from '../types.js'
import {
  isEmail,
  isURL,
  isMACAddress,
  isIP,
  isIPRange,
  isFQDN,
  isIBAN,
  isBIC,
  isAlpha,
  isAlphaLocales,
  isAlphanumeric,
  isAlphanumericLocales,
  isPassportNumber,
  isPort,
  isLowercase,
  isUppercase,
  isAscii,
  isSemVer,
  isSurrogatePair,
  isIMEI,
  isHexadecimal,
  isOctal,
  isHexColor,
  isRgbColor,
  isHSL,
  isISRC,
  isMD5,
  isJWT,
  isUUID,
  isLuhnNumber,
  isCreditCard,
  isIdentityCard,
  isEAN,
  isISIN,
  isISBN,
  isISSN,
  isMobilePhone,
  isMobilePhoneLocales,
  isPostalCode,
  isPostalCodeLocales,
  isEthereumAddress,
  isCurrency,
  isBtcAddress,
  isISO6391,
  isISO8601,
  isRFC3339,
  isISO31661Alpha2,
  isISO31661Alpha3,
  isISO4217,
  isBase32,
  isBase58,
  isBase64,
  isDataURI,
  isMagnetURI,
  isMimeType,
  isLatLong,
  isSlug,
  isStrongPassword,
  isTaxID,
  isLicensePlate,
  isVAT,
} from 'validator'

export type Validation = (
  payload: any,
  schema: SchemaProp<true>,
) => boolean | string
const EPSILON = 1e-9 // Small tolerance for floating point comparisons
const validators: Record<SchemaString['format'], (str: string) => boolean> = {
  email: isEmail,
  URL: isURL,
  MACAddress: isMACAddress,
  IP: isIP,
  IPRange: isIPRange,
  FQDN: isFQDN,
  IBAN: isIBAN,
  BIC: isBIC,
  alpha: isAlpha,
  alphaLocales: isAlphaLocales,
  alphanumeric: isAlphanumeric,
  alphanumericLocales: isAlphanumericLocales,
  passportNumber: isPassportNumber,
  port: isPort,
  lowercase: isLowercase,
  uppercase: isUppercase,
  ascii: isAscii,
  semVer: isSemVer,
  surrogatePair: isSurrogatePair,
  IMEI: isIMEI,
  hexadecimal: isHexadecimal,
  octal: isOctal,
  hexColor: isHexColor,
  rgbColor: isRgbColor,
  HSL: isHSL,
  ISRC: isISRC,
  MD5: isMD5,
  JWT: isJWT,
  UUID: isUUID,
  luhnNumber: isLuhnNumber,
  creditCard: isCreditCard,
  identityCard: isIdentityCard,
  EAN: isEAN,
  ISIN: isISIN,
  ISBN: isISBN,
  ISSN: isISSN,
  mobilePhone: isMobilePhone,
  mobilePhoneLocales: isMobilePhoneLocales,
  postalCode: isPostalCode,
  postalCodeLocales: isPostalCodeLocales,
  ethereumAddress: isEthereumAddress,
  currency: isCurrency,
  btcAddress: isBtcAddress,
  ISO6391: isISO6391,
  ISO8601: isISO8601,
  RFC3339: isRFC3339,
  ISO31661Alpha2: isISO31661Alpha2,
  ISO31661Alpha3: isISO31661Alpha3,
  ISO4217: isISO4217,
  base32: isBase32,
  base58: isBase58,
  base64: isBase64,
  dataURI: isDataURI,
  magnetURI: isMagnetURI,
  mimeType: isMimeType,
  latLong: isLatLong,
  slug: isSlug,
  password: isStrongPassword,
  taxID: isTaxID,
  licensePlate: isLicensePlate,
  VAT: isVAT,
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
}
export const VALIDATION_MAP: Record<TypeIndex, Validation> = {
  [NULL]: () => true,
  [OBJECT]: () => true,
  [COLVEC]: () => true,
  [ALIAS]: (value) => {
    if (typeof value !== 'string') {
      return false
    }
    return true
  },
  [BINARY]: (value) => {
    if (value instanceof Uint8Array) {
      return true
    }
    return false
  },
  [BOOLEAN]: (value) => {
    if (typeof value !== 'boolean') {
      return false
    }
    return true
  },
  [CARDINALITY]: (val) => {
    return (
      typeof val === 'string' ||
      (val instanceof Uint8Array && val.byteLength === 8)
    )
  },
  [TIMESTAMP]: (value, t: SchemaTimestamp<true>) => {
    if (typeof value !== 'number') {
      return false
    }
    const step = t.step || 0
    if (value % step !== 0) {
      return false
    }
    if (t.min !== undefined) {
      if (typeof t.min === 'number') {
        if (value < t.min) {
          return false
        }
      } else if (value < convertToTimestamp(t.min)) {
        return false
      }
    }
    if (t.max !== undefined) {
      if (typeof t.max === 'number') {
        if (value > t.max) {
          return false
        }
      } else if (value > convertToTimestamp(t.max)) {
        return false
      }
    }
    return true
  },
  [INT16]: (value, t: SchemaNumber) => {
    if (typeof value !== 'number' || value % t.step !== 0) {
      return false
    }
    if (value > 32767 || value < -32768) {
      return false
    }
    if (t.min !== undefined && value < t.min) {
      return false
    }
    if (t.max !== undefined && value > t.max) {
      return false
    }
    return true
  },
  [INT32]: (value, t: SchemaNumber) => {
    if (typeof value !== 'number' || value % t.step !== 0) {
      return false
    }
    if (value > 2147483647 || value < -2147483648) {
      return false
    }
    if (t.min !== undefined && value < t.min) {
      return false
    }
    if (t.max !== undefined && value > t.max) {
      return false
    }
    return true
  },
  [INT8]: (value, t: SchemaNumber) => {
    // use % for steps size
    if (typeof value !== 'number' || value % t.step !== 0) {
      return false
    }
    if (value > 127 || value < -128) {
      return false
    }
    if (t.min !== undefined && value < t.min) {
      return false
    }
    if (t.max !== undefined && value > t.max) {
      return false
    }
    return true
  },
  [UINT8]: (value, t: SchemaNumber) => {
    if (typeof value !== 'number' || value % t.step !== 0) {
      return false
    }
    if (value > 255 || value < 0) {
      return false
    }
    if (t.min !== undefined && value < t.min) {
      return false
    }
    if (t.max !== undefined && value > t.max) {
      return false
    }
    return true
  },
  [UINT16]: (value, t: SchemaNumber) => {
    if (typeof value !== 'number' || value % t.step !== 0) {
      return false
    }
    if (value > 65535 || value < 0) {
      return false
    }
    if (t.min !== undefined && value < t.min) {
      return false
    }
    if (t.max !== undefined && value > t.max) {
      return false
    }
    return true
  },
  [UINT32]: (value, t: SchemaNumber) => {
    if (typeof value !== 'number' || value % t.step !== 0) {
      return false
    }
    if (value > 4294967295 || value < 0) {
      return false
    }
    if (t.min !== undefined && value < t.min) {
      return false
    }
    if (t.max !== undefined && value > t.max) {
      return false
    }
    return true
  },
  [NUMBER]: (value, t: SchemaNumber) => {
    if (t.step) {
      const div = value / t.step
      if (Math.abs(div - Math.round(div)) > EPSILON) {
        return false
      }
    }
    if (typeof value !== 'number') {
      return false
    }
    if (t.min !== undefined && value < t.min) {
      return false
    }
    if (t.max !== undefined && value > t.max) {
      return false
    }
    return true
  },
  [ENUM]: (value, t: SchemaEnum) => {
    if (value === null) {
      return true
    }
    const arr = t.enum
    for (let i = 0; i < arr.length; i++) {
      if (value === arr[i]) {
        return true
      }
    }
    return false
  },
  [ID]: (value) => {
    if (typeof value !== 'number' || value % 1 !== 0) {
      return false
    }
    return true
  },
  [JSON]: (value) => {
    // mep
    return true
  },
  [MICRO_BUFFER]: (value) => {
    if (!(value instanceof Uint8Array)) {
      return false
    }
    return true
  },
  [REFERENCE]: (v) => {
    if (typeof v !== 'number') {
      return false
    }
    if (v === 0 || v > MAX_ID) {
      return false
    }
    return true
  },
  [REFERENCES]: (v) => {
    if (typeof v !== 'number') {
      return false
    }
    if (v === 0 || v > MAX_ID) {
      return false
    }
    return true
  },
  [STRING]: (v, t: SchemaString) => {
    if (v instanceof Uint8Array) {
      return !!v[1]
    }
    if (typeof v !== 'string') {
      return false
    }
    if (t.max !== undefined && v.length > t.max) {
      return false
    }
    if (t.min !== undefined && v.length < t.min) {
      return false
    }
    if (t.format !== undefined && t.format in validators) {
      return validators[t.format](v)
    }
    return true
  },
  [ALIASES]: (value) => {
    if (!Array.isArray(value)) {
      return false
    }
    const len = value.length
    for (let i = 0; i < len; i++) {
      if (typeof value[i] !== 'string') {
        return false
      }
    }
    return true
  },
  [VECTOR]: (value) => {
    // Array should be supported
    if (!(value instanceof Float32Array)) {
      return false
    }
    return true
  },
  [TEXT]: null,
}

VALIDATION_MAP[TEXT] = VALIDATION_MAP[STRING]

export const defaultValidation = () => true

export const isValidId = (id: number) => {
  if (typeof id != 'number' || id < MIN_ID || id > MAX_ID) {
    return false
  }
  return true
}

export const isValidString = (v: any) => {
  const isVal =
    typeof v === 'string' ||
    (v as any) instanceof Uint8Array ||
    ArrayBuffer.isView(v)
  return isVal
}

export function validate<S extends StrictSchema>(
  schema: S,
  type: keyof S['types'],
  payload: unknown,
) {
  if (payload === null || typeof payload !== 'object') {
  }
}
