import { convertToTimestamp } from '@based/utils'
import type { SchemaProp } from '../schema/prop.js'
import isEmail from 'validator/lib/isEmail.js'
import isURL from 'validator/lib/isURL.js'
import isMACAddress from 'validator/lib/isMACAddress.js'
import isIP from 'validator/lib/isIP.js'
import isIPRange from 'validator/lib/isIPRange.js'
import isFQDN from 'validator/lib/isFQDN.js'
import isIBAN from 'validator/lib/isIBAN.js'
import isBIC from 'validator/lib/isBIC.js'
import isAlpha from 'validator/lib/isAlpha.js'
import isAlphanumeric from 'validator/lib/isAlphanumeric.js'
import isPassportNumber from 'validator/lib/isPassportNumber.js'
import isPort from 'validator/lib/isPort.js'
import isLowercase from 'validator/lib/isLowercase.js'
import isUppercase from 'validator/lib/isUppercase.js'
import isAscii from 'validator/lib/isAscii.js'
import isSemVer from 'validator/lib/isSemVer.js'
import isSurrogatePair from 'validator/lib/isSurrogatePair.js'
import isIMEI from 'validator/lib/isIMEI.js'
import isHexadecimal from 'validator/lib/isHexadecimal.js'
import isOctal from 'validator/lib/isOctal.js'
import isHexColor from 'validator/lib/isHexColor.js'
import isRgbColor from 'validator/lib/isRgbColor.js'
import isHSL from 'validator/lib/isHSL.js'
import isISRC from 'validator/lib/isISRC.js'
import isMD5 from 'validator/lib/isMD5.js'
import isJWT from 'validator/lib/isJWT.js'
import isUUID from 'validator/lib/isUUID.js'
import isLuhnNumber from 'validator/lib/isLuhnNumber.js'
import isCreditCard from 'validator/lib/isCreditCard.js'
import isEAN from 'validator/lib/isEAN.js'
import isISIN from 'validator/lib/isISIN.js'
import isISBN from 'validator/lib/isISBN.js'
import isISSN from 'validator/lib/isISSN.js'
import isMobilePhone from 'validator/lib/isMobilePhone.js'
import isPostalCode from 'validator/lib/isPostalCode.js'
import isEthereumAddress from 'validator/lib/isEthereumAddress.js'
import isCurrency from 'validator/lib/isCurrency.js'
import isBtcAddress from 'validator/lib/isBtcAddress.js'
import isISO6391 from 'validator/lib/isISO6391.js'
import isISO8601 from 'validator/lib/isISO8601.js'
import isRFC3339 from 'validator/lib/isRFC3339.js'
import isISO31661Alpha2 from 'validator/lib/isISO31661Alpha2.js'
import isISO31661Alpha3 from 'validator/lib/isISO31661Alpha3.js'
import isISO4217 from 'validator/lib/isISO4217.js'
import isBase32 from 'validator/lib/isBase32.js'
import isBase58 from 'validator/lib/isBase58.js'
import isBase64 from 'validator/lib/isBase64.js'
import isDataURI from 'validator/lib/isDataURI.js'
import isMagnetURI from 'validator/lib/isMagnetURI.js'
import isMimeType from 'validator/lib/isMimeType.js'
import isLatLong from 'validator/lib/isLatLong.js'
import isSlug from 'validator/lib/isSlug.js'
import isStrongPassword from 'validator/lib/isStrongPassword.js'
import isTaxID from 'validator/lib/isTaxID.js'
import isLicensePlate from 'validator/lib/isLicensePlate.js'
import isVAT from 'validator/lib/isVAT.js'
import { isBoolean, isRecord, isString } from '../schema/shared.js'
import type { SchemaTimestamp } from '../schema/timestamp.js'
import type { SchemaNumber } from '../schema/number.js'
import type { SchemaEnum } from '../schema/enum.js'
import type { SchemaString } from '../schema/string.js'
import type { SchemaObject } from '../schema/object.js'
import type { SchemaOut } from '../schema/schema.js'

export type Validation = (
  payload: any,
  schema: SchemaProp<true>,
) => boolean | string

const allGood: Validation = () => true
const wrap = (validator: any) => (v: unknown) => validator(v)
export const validators = {
  email: wrap(isEmail),
  URL: wrap(isURL),
  MACAddress: wrap(isMACAddress),
  IP: wrap(isIP),
  IPRange: wrap(isIPRange),
  FQDN: wrap(isFQDN),
  IBAN: wrap(isIBAN),
  BIC: wrap(isBIC),
  alpha: wrap(isAlpha),
  alphanumeric: wrap(isAlphanumeric),
  passportNumber: wrap(isPassportNumber),
  port: wrap(isPort),
  lowercase: wrap(isLowercase),
  uppercase: wrap(isUppercase),
  ascii: wrap(isAscii),
  semVer: wrap(isSemVer),
  surrogatePair: wrap(isSurrogatePair),
  IMEI: wrap(isIMEI),
  hexadecimal: wrap(isHexadecimal),
  octal: wrap(isOctal),
  hexColor: wrap(isHexColor),
  rgbColor: wrap(isRgbColor),
  HSL: wrap(isHSL),
  ISRC: wrap(isISRC),
  MD5: wrap(isMD5),
  JWT: wrap(isJWT),
  UUID: wrap(isUUID),
  luhnNumber: wrap(isLuhnNumber),
  creditCard: wrap(isCreditCard),
  EAN: wrap(isEAN),
  ISIN: wrap(isISIN),
  ISBN: wrap(isISBN),
  ISSN: wrap(isISSN),
  mobilePhone: wrap(isMobilePhone),
  postalCode: wrap(isPostalCode),
  ethereumAddress: wrap(isEthereumAddress),
  currency: wrap(isCurrency),
  btcAddress: wrap(isBtcAddress),
  ISO6391: wrap(isISO6391),
  ISO8601: wrap(isISO8601),
  RFC3339: wrap(isRFC3339),
  ISO31661Alpha2: wrap(isISO31661Alpha2),
  ISO31661Alpha3: wrap(isISO31661Alpha3),
  ISO4217: wrap(isISO4217),
  base32: wrap(isBase32),
  base58: wrap(isBase58),
  base64: wrap(isBase64),
  dataURI: wrap(isDataURI),
  magnetURI: wrap(isMagnetURI),
  mimeType: wrap(isMimeType),
  latLong: wrap(isLatLong),
  slug: wrap(isSlug),
  password: wrap(isStrongPassword),
  taxID: wrap(isTaxID),
  licensePlate: wrap(isLicensePlate),
  VAT: wrap(isVAT),
  code: allGood,
  javascript: allGood,
  typescript: allGood,
  python: allGood,
  rust: allGood,
  css: allGood,
  html: allGood,
  json: allGood,
  markdown: allGood,
  clike: allGood,
} as const

export const MAX_ID = 4_294_967_295
const epsilon = 1e-9 // Small tolerance for floating point comparisons
export const isValidId = (v) => v > 0 && v <= MAX_ID
const getIntValidaton =
  (min: number, max: number): Validation =>
  (value, t: SchemaNumber) => {
    if (
      typeof value !== 'number' ||
      (t.step && value % t.step !== 0) ||
      isNaN(value)
    ) {
      return false
    }
    if (value > max || value < min) {
      return false
    }
    if (t.min !== undefined && value < t.min) {
      return false
    }
    if (t.max !== undefined && value > t.max) {
      return false
    }
    return true
  }
const isStringLike: Validation = (v, t: SchemaString) => {
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
    return validators[t.format](v, t)
  }
  return true
}

export const validationMap: Record<SchemaProp<true>['type'], Validation> = {
  object: isRecord,
  colvec: allGood,
  alias: isString,
  binary: (v) => v instanceof Uint8Array,
  boolean: isBoolean,
  cardinality: (v) =>
    isString(v) || (v instanceof Uint8Array && v.byteLength === 8),
  timestamp: (v, t: SchemaTimestamp<true>) => {
    if (typeof v !== 'number' || (t.step && v % t.step !== 0) || isNaN(v)) {
      return false
    }
    if (t.min !== undefined) {
      if (typeof t.min === 'number') {
        if (v < t.min) {
          return false
        }
      } else if (v < convertToTimestamp(t.min)) {
        return false
      }
    }
    if (t.max !== undefined) {
      if (typeof t.max === 'number') {
        if (v > t.max) {
          return false
        }
      } else if (v > convertToTimestamp(t.max)) {
        return false
      }
    }
    return true
  },
  int8: getIntValidaton(-128, 127),
  int16: getIntValidaton(-32_768, 32_767),
  int32: getIntValidaton(-2_147_483_648, 2_147_483_647),
  uint8: getIntValidaton(0, 255),
  uint16: getIntValidaton(0, 65_535),
  uint32: getIntValidaton(0, MAX_ID),
  number: (v, t: SchemaNumber) => {
    if (t.step) {
      const div = v / t.step
      if (Math.abs(div - Math.round(div)) > epsilon) {
        return false
      }
    }
    if (typeof v !== 'number') {
      return false
    }
    if (t.min !== undefined && v < t.min) {
      return false
    }
    if (t.max !== undefined && v > t.max) {
      return false
    }
    return true
  },
  enum: (v, t: SchemaEnum<true>) => {
    if (v === null) {
      return true
    }
    const arr = t.enum
    for (let i = 0; i < arr.length; i++) {
      if (v === arr[i]) {
        return true
      }
    }
    return false
  },
  json: allGood,
  reference: isValidId,
  references: isValidId,
  string: isStringLike,
  text: isStringLike,
  vector: (v) => v instanceof Float32Array,
}

type ValidationErrors = { path: string[]; value: unknown; error: string }[]

const validateObj = (
  value: unknown,
  props: Record<string, SchemaProp<true>> | SchemaObject<true>,
  errors: ValidationErrors,
  path: string[],
  required: boolean,
) => {
  if (!props) {
    errors.push({ path, value, error: 'Unexpected property' })
    return
  }

  if (value === null || typeof value !== 'object') {
    if (required) {
      errors.push({ path, value, error: 'Missing required value' })
      return
    }
  } else {
    for (const key in value) {
      if (!(key in props)) {
        errors.push({
          path: [...path, key],
          value: value[key],
          error: 'Unexpected property',
        })
      }
    }
  }

  for (const key in props) {
    const val = value?.[key]
    const prop = props[key]
    if ('props' in prop) {
      validateObj(val, prop.props, errors, [...path, key], prop.required)
    } else if (val !== undefined) {
      const test = getValidator(prop)
      if ('items' in prop) {
        if (typeof val !== 'object' || val === null) {
          errors.push({
            path: [...path, key],
            value: val,
            error: 'Invalid value',
          })
        }
        let arr = val
        if (!Array.isArray(val)) {
          arr = []
          for (const i in val) {
            if (i === 'add') {
              arr.push(...val.add)
            } else if (i === 'update') {
              arr.push(...val.update)
            } else if (i === 'delete') {
              arr.push(...val.delete)
            } else {
              arr = []
              break
            }
          }
          if (!arr.length) {
            errors.push({
              path: [...path, key],
              value: arr,
              error: 'Invalid value',
            })
          }
        }

        for (const val of arr) {
          const msg =
            typeof val === 'object' ? test(val?.id, prop) : test(val, prop)
          if (msg !== true) {
            errors.push({
              path: [...path, key],
              value: val,
              error: typeof msg === 'string' ? msg : 'Invalid value',
            })
          }
        }
      } else {
        const msg =
          prop.type === 'reference' && typeof val === 'object'
            ? test(val?.id, prop)
            : test(val, prop)
        if (msg !== true) {
          errors.push({
            path: [...path, key],
            value: val,
            error: typeof msg === 'string' ? msg : 'Invalid value',
          })
        }
      }
    }
  }
}

export const getValidator = (prop: SchemaProp<true>): Validation => {
  const validator = validationMap[prop.type]
  const custom = prop.validation
  if (custom) {
    return (a, b) => {
      const msg = custom(a, b)
      return msg === true ? validator(a, b) : msg
    }
  }
  return validator
}

export function validate<S extends SchemaOut = SchemaOut>(
  schema: S,
  type: keyof S['types'],
  payload: unknown,
): {
  valid: boolean
  errors: ValidationErrors
} {
  const errors = []
  validateObj(payload, schema?.types?.[type as string]?.props, errors, [], true)
  return {
    valid: !errors.length,
    errors,
  }
}
