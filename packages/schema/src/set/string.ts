import { Parser } from './types'
import { error, ParseError } from './error'
import {
  BasedSchemaFieldString,
  BasedSchemaFieldText,
  BasedSchemaLanguage,
} from '../types'
import validators from 'validator'
import { parseValueAndDefault } from './parseDefaultAndValue'

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

const validate = (
  path: (string | number)[],
  value: string,
  fieldSchema: BasedSchemaFieldText | BasedSchemaFieldString
) => {
  if (typeof value !== 'string') {
    error(path, ParseError.incorrectFormat)
  }
  if (fieldSchema.minLength && value.length < fieldSchema.minLength) {
    error(path, ParseError.subceedsMinimum)
  }
  if (fieldSchema.maxLength && value.length > fieldSchema.maxLength) {
    error(path, ParseError.exceedsMaximum)
  }
  if (fieldSchema.pattern) {
    const re = new RegExp(fieldSchema.pattern)
    if (!re.test(value)) {
      error(path, ParseError.incorrectFormat)
    }
  }
  if (fieldSchema.format && !formatPatterns[fieldSchema.format](value)) {
    error(path, ParseError.incorrectFormat)
  }
  // return true / false and add collectError
}

export const string: Parser<'string'> = async (
  path,
  value,
  fieldSchema,
  typeSchema,
  target,
  handlers,
  noCollect
) => {
  if (
    await parseValueAndDefault(
      path,
      value,
      fieldSchema,
      typeSchema,
      target,
      handlers,
      noCollect
    )
  ) {
    return
  }
  validate(path, value, fieldSchema)
  if (!noCollect) {
    handlers.collect({ path, value, typeSchema, fieldSchema, target })
  }
}

export const text: Parser<'text'> = async (
  path,
  value,
  fieldSchema,
  typeSchema,
  target,
  handlers,
  noCollect
) => {
  console.info('go ---> do text', path, noCollect)

  const valueType = typeof value
  if (target.$language && valueType === 'string') {
    validate(path, value, fieldSchema)
    if (!noCollect) {
      handlers.collect({
        path,
        value: { [target.$language]: value },
        typeSchema,
        fieldSchema,
        target,
      })
    }
    return
  }

  if (valueType !== 'object') {
    error(path, ParseError.incorrectFormat)
  }

  if (
    target.$language &&
    (await parseValueAndDefault(
      path,
      value,
      fieldSchema,
      typeSchema,
      target,
      handlers,
      true
    ))
  ) {
    if (!noCollect) {
      handlers.collect({
        path,
        value: {
          [target.$language]: value,
        },
        typeSchema,
        fieldSchema,
        target,
      })
    }
    return
  } else if (
    await parseValueAndDefault(
      path,
      value,
      fieldSchema,
      typeSchema,
      target,
      handlers,
      true
    )
  ) {
    if (!noCollect) {
      handlers.collect({
        path,
        value,
        typeSchema,
        fieldSchema,
        target,
      })
    }
    return
  }

  for (const key in value) {
    if (!target.schema.languages.includes(<BasedSchemaLanguage>key)) {
      error(path, ParseError.languageNotSupported)
    }

    if (typeof value[key] === 'object') {
      if (
        await parseValueAndDefault(
          path,
          value[key],
          fieldSchema,
          typeSchema,
          target,
          handlers,
          true
        )
      ) {
        continue
      }
    }

    if (
      !(await parseValueAndDefault(
        path,
        { [key]: value[key] },
        fieldSchema,
        typeSchema,
        target,
        handlers,
        true
      ))
    ) {
      validate(path, value[key], fieldSchema)
    }
  }

  if (!noCollect) {
    handlers.collect({
      path,
      value,
      typeSchema,
      fieldSchema,
      target,
    })
  }
}
