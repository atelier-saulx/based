import {
  BasedSchemaFieldString,
  BasedSchemaLanguage,
  BasedSetTarget,
} from '../../types'
import { ParseError } from '../../set/error'
import { FieldParser, ArgsClass } from '../../walker'
import validators from 'validator'
import { setByPath } from '@saulx/utils'

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

export const text: FieldParser<'text'> = async (args) => {
  const value = args.value

  if (value !== null && typeof value === 'object') {
    if ('$value' in value) {
      return
    }
    args.stop()

    const result: any = {}

    for (const key in value) {
      if (key === '$default') {
        const defaultArgs = args.create({
          key,
          value: value.$default,
          skipCollection: true,
        })
        await defaultArgs.parse()
        result.$default = defaultArgs.value
      } else if (args.schema.languages.includes(<BasedSchemaLanguage>key)) {
        if (value[key] && typeof value[key] === 'object') {
          for (const k in value[key]) {
            if (key === '$value') {
              if (!validateString(args, value[key].$value)) {
                args.create({ key }).error(ParseError.incorrectFormat)
              } else {
                result[key] = value[key].$value
              }
            } else if (k === '$default') {
              if (!validateString(args, value[key].$default)) {
                args.create({ key }).error(ParseError.incorrectFormat)
              } else {
                setByPath(result, ['$default', key], value[key].$default)
              }
            } else {
              args
                .create({ path: [...args.path, key, k] })
                .error(ParseError.fieldDoesNotExist)
            }
          }
        } else {
          if (!validateString(args, args.value[key])) {
            args.error(ParseError.incorrectFormat)
            return
          }
          result[key] = args.value[key]
        }
      } else {
        args.create({ key }).error(ParseError.languageNotSupported)
      }
    }

    args.collect(result)

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

  args.value = {
    [args.target.$language]: value,
  }

  args.collect()
}
