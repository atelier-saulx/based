import {
  BasedSchemaFieldString,
  BasedSchemaFieldText,
  BasedSchemaLanguage,
  BasedSetHandlers,
  BasedSetTarget,
} from '../../types'
import { ParseError } from '../../set/error'
import { FieldParser, Args } from '../../walker'
import validators from 'validator'
import { object } from './object'

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
  args: Args<BasedSetTarget, StringTypes>,
  value: string,
  ignoreMinMax?: boolean
): boolean => {
  const { fieldSchema } = args

  if (typeof value !== 'string') {
    // console.log('--------------------------------------__>')
    args.error(args, ParseError.incorrectFormat)
    return false
  }
  if (fieldSchema.minLength && value.length < fieldSchema.minLength) {
    args.error(args, ParseError.subceedsMinimum)
    return false
  }
  if (fieldSchema.maxLength && value.length > fieldSchema.maxLength) {
    args.error(args, ParseError.exceedsMaximum)
    return false
  }
  if (fieldSchema.pattern) {
    const re = new RegExp(fieldSchema.pattern)
    if (!re.test(value)) {
      args.error(args, ParseError.incorrectFormat)
      return false
    }
  }
  if (fieldSchema.format && !formatPatterns[fieldSchema.format](value)) {
    args.error(args, ParseError.incorrectFormat)
    return false
  }
  return true
}

const validate = (
  args: Args<BasedSetTarget, StringTypes>,
  value: any
): boolean => {
  if (typeof value !== 'object') {
    return validateString(args, value)
  }
}

export const string: FieldParser<'string'> = async (args) => {
  if (!validate(args, args.value)) {
    return
  }

  args.collect(args)
}

export const text: FieldParser<'text'> = async (args) => {
  //   console.log('XXXXXXXXXXXXXXXXXXXXXx', args)
  const value = args.value
  if (args.parentValue.$language && typeof value === 'string') {
    args.stop()
    if (!validate(args, value)) {
      return
    }
    args.collect(args)
  }

  if (typeof value !== 'object') {
    args.error(args, ParseError.incorrectFormat)
  }

  for (const key in value) {
    console.log([key], value[key], 'miauw')
    if (!args.target.schema.languages.includes(<BasedSchemaLanguage>key)) {
      console.log('error  miauw')
      args.error(args, ParseError.languageNotSupported)
    }
  }

  // if (typeof value[key] === 'object') {
  //   if (
  //     await parseValueAndDefault(
  //       path,
  //       value[key],
  //       fieldSchema,
  //       typeSchema,
  //       args.target,
  //       handlers,
  //       true
  //     )
  //   ) {
  //     continue
  //   }
  // }

  //   if (
  //     !(await parseValueAndDefault(
  //       path,
  //       { [key]: value[key] },
  //       fieldSchema,
  //       typeSchema,
  //       args.target,
  //       handlers,
  //       true
  //     ))
  //   ) {
  //     validate(handlers, path, value[key], fieldSchema)
  //   }
  // }

  // if (!noCollect) {
  //   handlers.collect({
  //     path,
  //     value,
  //     typeSchema,
  //     fieldSchema,
  //     args.target,
  //   })
  // }
}
