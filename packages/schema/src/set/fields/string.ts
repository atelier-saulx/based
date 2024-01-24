import {
  BasedSchemaFieldString,
  BasedSchemaLanguage,
  BasedSetTarget,
} from '../../types.js'
import { ParseError } from '../../error.js'
import { FieldParser, ArgsClass } from '../../walker/index.js'
import validators from 'validator'

type StringTypes = 'string' | 'text'

const formatPatterns: Record<
  BasedSchemaFieldString['format'],
  (str: string) => boolean
> = {
  email: validators.isEmail,
  URL: validators.isURL,
  MACAddress: validators.isMACAddress,
  IP: validators.isIP,
  IPRange: validators.isIPRange,
  FQDN: validators.isFQDN,
  IBAN: validators.isIBAN,
  BIC: validators.isBIC,
  alpha: validators.isAlpha,
  alphaLocales: validators.isAlphaLocales,
  alphanumeric: validators.isAlphanumeric,
  alphanumericLocales: validators.isAlphanumericLocales,
  passportNumber: validators.isPassportNumber,
  port: validators.isPort,
  lowercase: validators.isLowercase,
  uppercase: validators.isUppercase,
  ascii: validators.isAscii,
  semVer: validators.isSemVer,
  surrogatePair: validators.isSurrogatePair,
  IMEI: validators.isIMEI,
  hexadecimal: validators.isHexadecimal,
  octal: validators.isOctal,
  hexColor: validators.isHexColor,
  rgbColor: validators.isRgbColor,
  HSL: validators.isHSL,
  ISRC: validators.isISRC,
  MD5: validators.isMD5,
  JWT: validators.isJWT,
  UUID: validators.isUUID,
  luhnNumber: validators.isLuhnNumber,
  creditCard: validators.isCreditCard,
  identityCard: validators.isIdentityCard,
  EAN: validators.isEAN,
  ISIN: validators.isISIN,
  ISBN: validators.isISBN,
  ISSN: validators.isISSN,
  mobilePhone: validators.isMobilePhone,
  mobilePhoneLocales: validators.isMobilePhoneLocales,
  postalCode: validators.isPostalCode,
  postalCodeLocales: validators.isPostalCodeLocales,
  ethereumAddress: validators.isEthereumAddress,
  currency: validators.isCurrency,
  btcAddress: validators.isBtcAddress,
  ISO6391: validators.isISO6391,
  ISO8601: validators.isISO8601,
  RFC3339: validators.isRFC3339,
  ISO31661Alpha2: validators.isISO31661Alpha2,
  ISO31661Alpha3: validators.isISO31661Alpha3,
  ISO4217: validators.isISO4217,
  base32: validators.isBase32,
  base58: validators.isBase58,
  base64: validators.isBase64,
  dataURI: validators.isDataURI,
  magnetURI: validators.isMagnetURI,
  mimeType: validators.isMimeType,
  latLong: validators.isLatLong,
  slug: validators.isSlug,
  strongPassword: validators.isStrongPassword,
  taxID: validators.isTaxID,
  licensePlate: validators.isLicensePlate,
  VAT: validators.isVAT,
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
  // Can add some more checks for this...
  basedId: (value) => typeof value === 'string' && value.length < 16,
}

const validateString = (
  args: ArgsClass<BasedSetTarget, StringTypes>,
  value: string
): boolean => {
  if (typeof value !== 'string') {
    args.error(ParseError.incorrectFormat)
    return false
  }
  if (args.fieldSchema.minLength && value.length < args.fieldSchema.minLength) {
    args.error(ParseError.subceedsMinimum)
    return false
  }
  if (args.fieldSchema.maxLength && value.length > args.fieldSchema.maxLength) {
    args.error(ParseError.exceedsMaximum)
    return false
  }
  if (args.fieldSchema.pattern) {
    const re = new RegExp(args.fieldSchema.pattern)
    if (!re.test(value)) {
      args.error(ParseError.incorrectFormat)
      return false
    }
  }
  if (
    args.fieldSchema.format &&
    !formatPatterns[args.fieldSchema.format](value)
  ) {
    args.error(ParseError.incorrectFormat)
    return false
  }
  return true
}

export const string: FieldParser<'string'> = async (args) => {
  if (!validateString(args, args.value)) {
    return
  }
  args.collect()
}

// --- bla
// if typeof === string
export const text: FieldParser<'text'> = async (args) => {
  const value = args.value

  args.stop()

  if (value === null) {
    args.error(ParseError.incorrectFormat)
    return
  }

  if (typeof value === 'object') {
    for (const key in value) {
      if (key === '$merge') {
        if (typeof value.$merge !== 'boolean') {
          args.error(ParseError.incorrectFormat)
          return
        }
      } else if (key === '$delete') {
        if (value[key] !== true) {
          args.error(ParseError.incorrectFormat)
          return
        }
        args.collect({ $delete: true })
        return
      } else if (key === '$value') {
        const valueArgs = args.create({
          path: args.path,
          value: args.value[key],
        })
        valueArgs._stopObject = true
        await valueArgs.parse()
      } else if (key === '$default') {
        if (value[key] === null) {
          args.error(ParseError.incorrectFormat)
          return
        }
        if (typeof value[key] === 'object') {
          for (const k in value[key]) {
            if (!validateString(args, args.value[key][k])) {
              args.error(ParseError.incorrectFormat)
              return
            }
            args
              .create({
                key: k,
                fieldSchema: { type: 'string' },
                value: { $default: args.value[key][k] },
              })
              .collect()
          }
        } else if (typeof value[key] !== 'string') {
          args.error(ParseError.incorrectFormat)
          return
        } else if (!args.target.$language) {
          args.error(ParseError.noLanguageFound)
          return
        } else if (!validateString(args, value[key])) {
          args.error(ParseError.incorrectFormat)
          return
        } else {
          args
            .create({
              fieldSchema: { type: 'string' },
              key: args.target.$language,
              value: { $default: args.value[key] },
            })
            .collect()
        }
      } else if (
        (args.schema.translations || [])
          .concat(args.schema.language)
          .includes(<BasedSchemaLanguage>key)
      ) {
        if (value[key] && typeof value[key] === 'object') {
          for (const k in value[key]) {
            if (k === '$delete') {
              if (value[key].$delete !== true) {
                args.error(ParseError.incorrectFormat)
                return
              }
              args
                .create({
                  key,
                  fieldSchema: { type: 'string' },
                  value: args.value[key],
                })
                .collect()
            } else if (k === '$value') {
              if (!validateString(args, value[key].$value)) {
                args.create({ key }).error(ParseError.incorrectFormat)
              } else {
                args
                  .create({
                    key,
                    fieldSchema: { type: 'string' },
                    value: args.value[key].$value,
                  })
                  .collect()
              }
            } else if (k === '$default') {
              if (!validateString(args, value[key].$default)) {
                args.create({ key }).error(ParseError.incorrectFormat)
              } else {
                args
                  .create({
                    key,
                    fieldSchema: { type: 'string' },
                    value: { $default: args.value[key].$default },
                  })
                  .collect()
              }
            } else {
              args
                .create({ path: [...args.path, key, k] })
                .error(ParseError.fieldDoesNotExist)
              return
            }
          }
        } else {
          if (!validateString(args, args.value[key])) {
            args.error(ParseError.incorrectFormat)
            return
          }
          args
            .create({
              key,
              fieldSchema: { type: 'string' },
              value: args.value[key],
            })
            .collect()
        }
      } else {
        args.create({ key }).error(ParseError.languageNotSupported)
      }
    }
    if (!args._stopObject) {
      args.collect()
    }
    return
  }

  if (typeof value !== 'string') {
    args.error(ParseError.incorrectFormat)
    return
  }

  if (!args.target.$language) {
    args.error(ParseError.noLanguageFound)
    return
  }

  if (!validateString(args, args.value)) {
    args.error(ParseError.incorrectFormat)
    return
  }

  args
    .create({
      value,
      key: args.target.$language,
      fieldSchema: { type: 'string' },
    })
    .collect()

  if (!args._stopObject) {
    args.collect({
      [args.target.$language]: value,
    })
  }
}
