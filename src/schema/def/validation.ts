import { convertToTimestamp } from '../../utils/index.js'
import v from 'validator'
import type { SchemaProp } from '../schema/prop.js'
import type { SchemaTimestamp } from '../schema/timestamp.js'
import type { SchemaNumber } from '../schema/number.js'
import type { SchemaEnum } from '../schema/enum.js'
import {
  isVector,
  MAX_ID,
  MIN_ID,
  type SchemaObject,
  type SchemaOut,
  type SchemaProps,
  type SchemaString,
} from '../index.js'
import { PropType, PropTypeEnum } from '../../zigTsExports.js'

export type Validation = (
  payload: any,
  schema: SchemaProp<true>,
) => boolean | string

const EPSILON = 1e-9 // Small tolerance for floating point comparisons

export const validators = {
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

export const VALIDATION_MAP: Record<PropTypeEnum, Validation> = {
  [PropType.null]: () => true,
  [PropType.object]: () => true,
  [PropType.colVec]: () => true,
  [PropType.alias]: (value) => {
    if (typeof value !== 'string') {
      return false
    }
    return true
  },
  [PropType.binary]: (value) => {
    if (value instanceof Uint8Array) {
      return true
    }
    return false
  },
  [PropType.boolean]: (value) => {
    if (typeof value !== 'boolean') {
      return false
    }
    return true
  },
  [PropType.cardinality]: (val) => {
    return (
      typeof val === 'string' ||
      (val instanceof Uint8Array && val.byteLength === 8)
    )
  },
  [PropType.timestamp]: (value, t: SchemaTimestamp<true>) => {
    if (
      typeof value !== 'number' ||
      (t.step && value % t.step !== 0) ||
      isNaN(value)
    ) {
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
  [PropType.int16]: (value, t: SchemaNumber) => {
    if (
      typeof value !== 'number' ||
      (t.step && value % t.step !== 0) ||
      isNaN(value)
    ) {
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
  [PropType.int32]: (value, t: SchemaNumber) => {
    if (
      typeof value !== 'number' ||
      (t.step && value % t.step !== 0) ||
      isNaN(value)
    ) {
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
  [PropType.int8]: (value, t: SchemaNumber) => {
    // use % for steps size
    if (
      typeof value !== 'number' ||
      (t.step && value % t.step !== 0) ||
      isNaN(value)
    ) {
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
  [PropType.uint8]: (value, t: SchemaNumber) => {
    if (
      typeof value !== 'number' ||
      (t.step && value % t.step !== 0) ||
      isNaN(value)
    ) {
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
  [PropType.uint16]: (value, t: SchemaNumber) => {
    if (
      typeof value !== 'number' ||
      (t.step && value % t.step !== 0) ||
      isNaN(value)
    ) {
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
  [PropType.uint32]: (value, t: SchemaNumber) => {
    if (
      typeof value !== 'number' ||
      (t.step && value % t.step !== 0) ||
      isNaN(value)
    ) {
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
  [PropType.number]: (value, t: SchemaNumber) => {
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
  [PropType.enum]: (value, t: SchemaEnum<true>) => {
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
  [PropType.id]: (value) => {
    if (typeof value !== 'number' || value % 1 !== 0) {
      return false
    }
    return true
  },
  [PropType.json]: (value) => {
    // mep
    return true
  },
  [PropType.microBuffer]: (value) => {
    if (!(value instanceof Uint8Array)) {
      return false
    }
    return true
  },
  [PropType.reference]: (v) => {
    if (typeof v !== 'number') {
      return false
    }
    if (v === 0 || v > MAX_ID) {
      return false
    }
    return true
  },
  [PropType.references]: (v) => {
    if (typeof v !== 'number') {
      return false
    }
    if (v === 0 || v > MAX_ID) {
      return false
    }
    return true
  },
  [PropType.string]: (v, t: SchemaString) => {
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
  [PropType.aliases]: (value) => {
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
  [PropType.vector]: (value) => {
    return isVector(value)
  },
  // @ts-ignore
  [PropType.text]: null,
}

VALIDATION_MAP[PropType.text] = VALIDATION_MAP[PropType.string]

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

type ValidationErrors = { path: string[]; value: unknown; error: string }[]

const validateObj = (
  value: unknown,
  props: SchemaProps<true> | SchemaObject<true>,
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
  const validator =
    // @ts-ignore
    VALIDATION_MAP[PropType[prop.type as keyof typeof PropType]] ??
    defaultValidation
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
  // @ts-ignore
  validateObj(payload, schema?.types?.[type as string]?.props, errors, [], true)
  return {
    valid: !errors.length,
    errors,
  }
}
