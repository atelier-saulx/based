import type { Language } from './languages.js'
import { languages as allLanguages } from './languages.js'
import type { PartialDeep } from 'type-fest'
import { ParseError } from './error.js'
import { ArgsClass, Path } from './walker/index.js'
import { StringFormat } from './display/string.js'
import { NumberFormat } from './display/number.js'
import { DateFormat } from './display/timestamp.js'

// Schema type
// inspiration from https://json-schema.org/understanding-json-schema/index.html
// but added a few extra types
//   reference
//   references
//   set
//   record

// https://json-schema.org/learn/examples/geographical-location.schema.json

// contentSchema can be used for JSON types as well
// contentSchema can be used for reference / refrences

// TODO parser / validator / parseOut / parseIn (parsIn after validator)

// for refs etc check https://json-schema.org/understanding-json-schema/structuring.html#defs

export type AllowedTypes = (string | { type?: string; $filter: any | any[] })[]

export const basedSchemaFieldTypes = [
  'array',
  'object',
  'record',
  'set',
  'string',
  'boolean',
  'number',
  'json',
  'integer',
  'timestamp',
  'reference',
  'references',
  'text',
  'enum',
  'cardinality',
] as const

export type BasedSchemaFieldType = (typeof basedSchemaFieldTypes)[number]

export const isCollection = (type: string): boolean => {
  return type === 'array' || type === 'object' || type === 'record'
}

export type BasedSchemaPattern = string // RE ^[A-Za-z_][A-Za-z0-9_]*$

export type BasedSchemaLanguage = Language // fix
export const languages = Object.keys(allLanguages)

export type BasedSchemaTypePrefix = string // fix

// Some examples
export type BasedSchemaContentMediaType =
  | 'text/html'
  | 'text/plain'
  | 'text/markdown'
  | 'image/png'
  | 'image/jpeg'
  | 'video/mp4'
  | 'image/*'
  | 'video/*'
  | 'audio/*'
  | '*/*'
  | `${string}/${string}`

export type BasedSchemaFieldShared = {
  hooks?:
    | { interval?: number; hook: string }
    | { interval?: number; hook: string }[]
  type?: BasedSchemaFieldType
  $id?: string
  $schema?: string
  isRequired?: boolean
  title?: string
  description?: string
  index?: number // Determines the order of fields
  readOnly?: boolean
  writeOnly?: boolean
  $comment?: string
  examples?: any[] // <--- make this generic
  default?: any // <-- make this generic
  // extra thing by us allow users to overwrite entire validations
  customValidator?: (
    value: any,
    path: (number | string)[],
    target: BasedSetTarget
  ) => Promise<boolean>
  $defs?: { [key: string]: BasedSchemaField }
  // TODO: This is an option. Should be in another place
  $delete?: boolean
}

// -------------- Primitive ---------------
export type BasedSchemaStringShared = {
  minLength?: number
  maxLength?: number
  contentMediaEncoding?: string // base64
  contentMediaType?: BasedSchemaContentMediaType // 'image/*'
  pattern?: BasedSchemaPattern // TODO: does not exist
  format?:
    | 'email'
    | 'URL'
    | 'MACAddress'
    | 'IP'
    | 'IPRange'
    | 'FQDN'
    | 'IBAN'
    | 'BIC'
    | 'alpha'
    | 'alphaLocales'
    | 'alphanumeric'
    | 'alphanumericLocales'
    | 'passportNumber'
    | 'port'
    | 'lowercase'
    | 'uppercase'
    | 'ascii'
    | 'semVer'
    | 'surrogatePair'
    | 'IMEI'
    | 'hexadecimal'
    | 'octal'
    | 'hexColor'
    | 'rgbColor'
    | 'HSL'
    | 'ISRC'
    | 'MD5'
    | 'JWT'
    | 'UUID'
    | 'luhnNumber'
    | 'creditCard'
    | 'identityCard'
    | 'EAN'
    | 'ISIN'
    | 'ISBN'
    | 'ISSN'
    | 'mobilePhone'
    | 'mobilePhoneLocales'
    | 'postalCode'
    | 'postalCodeLocales'
    | 'ethereumAddress'
    | 'currency'
    | 'btcAddress'
    | 'ISO6391'
    | 'ISO8601'
    | 'RFC3339'
    | 'ISO31661Alpha2'
    | 'ISO31661Alpha3'
    | 'ISO4217'
    | 'base32'
    | 'base58'
    | 'base64'
    | 'dataURI'
    | 'magnetURI'
    | 'mimeType'
    | 'latLong'
    | 'slug'
    | 'strongPassword'
    | 'taxID'
    | 'licensePlate'
    | 'VAT'
    | 'code'
    | 'typescript'
    | 'javascript'
    | 'python'
    | 'rust'
    | 'css'
    | 'html'
    | 'json'
    | 'markdown'
    | 'clike'
  display?: StringFormat
  multiline?: boolean
}

type NumberDefaults = {
  multipleOf?: number
  minimum?: number
  maximum?: number
  exclusiveMaximum?: boolean
  exclusiveMinimum?: boolean
}

export type BasedNumberDisplay = NumberFormat

export type BasedTimestampDisplay = DateFormat

export type BasedSchemaFieldString = {
  type: 'string'
} & BasedSchemaFieldShared &
  BasedSchemaStringShared

export type BasedSchemaFieldEnum = {
  enum: any[]
  type?: ''
} & BasedSchemaFieldShared

export type BasedSchemaFieldCardinality = {
  type: 'cardinality'
} & BasedSchemaFieldShared

export type BasedSchemaFieldNumber = NumberDefaults & {
  type: 'number'
  display?: BasedNumberDisplay
} & BasedSchemaFieldShared

export type BasedSchemaFieldInteger = NumberDefaults & {
  type: 'integer'
  display?: BasedNumberDisplay
} & BasedSchemaFieldShared

export type BasedSchemaFieldTimeStamp = NumberDefaults & {
  type: 'timestamp'
  display?: BasedTimestampDisplay
} & BasedSchemaFieldShared

export type BasedSchemaFieldBoolean = {
  type: 'boolean'
} & BasedSchemaFieldShared

// Can support full json SCHEMA validation for this
export type BasedSchemaFieldJSON = {
  type: 'json'
  format?: 'rich-text'
} & BasedSchemaFieldShared

export type BasedSchemaFieldPrimitive =
  | BasedSchemaFieldString
  | BasedSchemaFieldNumber
  | BasedSchemaFieldInteger
  | BasedSchemaFieldTimeStamp
  | BasedSchemaFieldJSON
  | BasedSchemaFieldBoolean
  | BasedSchemaFieldEnum

// -------------- Enumerable ---------------
export type BasedSchemaFieldText = {
  type: 'text'
  required?: BasedSchemaLanguage[]
} & BasedSchemaFieldShared &
  BasedSchemaStringShared

export type BasedSchemaFieldObject = {
  type: 'object'
  properties: {
    [name: string]: BasedSchemaField
  }
  required?: string[]
} & BasedSchemaFieldShared

export type BasedSchemaFieldRecord = {
  type: 'record'
  values: BasedSchemaField
} & BasedSchemaFieldShared

export type BasedSchemaFieldArray = {
  type: 'array'
  values: BasedSchemaField
} & BasedSchemaFieldShared

export type BasedSchemaFieldSet = {
  type: 'set'
  items: BasedSchemaFieldPrimitive
} & BasedSchemaFieldShared

export type BasedSchemaFieldEnumerable =
  | BasedSchemaFieldText
  | BasedSchemaFieldObject
  | BasedSchemaFieldRecord
  | BasedSchemaFieldArray
  | BasedSchemaFieldSet

// -------------- Reference ---------------
export type BasedSchemaFieldReference = {
  type: 'reference'
  bidirectional?: {
    fromField: string
  }
  // TODO: selva filters { $operator: 'includes', $value: 'image/', $field: 'mimeType' }
  allowedTypes?: AllowedTypes
} & BasedSchemaFieldShared

// make extra package called based db - query (maybe in based-db)
export type BasedSchemaFieldReferences = {
  type: 'references'
  bidirectional?: {
    fromField: string
  }
  allowedTypes?: AllowedTypes
} & BasedSchemaFieldShared

// return type can be typed - sort of

export type BasedSchemaFields = {
  string: BasedSchemaFieldString
  number: BasedSchemaFieldNumber
  integer: BasedSchemaFieldInteger
  timestamp: BasedSchemaFieldTimeStamp
  json: BasedSchemaFieldJSON
  boolean: BasedSchemaFieldBoolean
  enum: BasedSchemaFieldEnum
  array: BasedSchemaFieldArray
  object: BasedSchemaFieldObject
  set: BasedSchemaFieldSet
  record: BasedSchemaFieldRecord
  reference: BasedSchemaFieldReference
  references: BasedSchemaFieldReferences
  text: BasedSchemaFieldText
  cardinality: BasedSchemaFieldCardinality
}

export type BasedSchemaField =
  | BasedSchemaFields[keyof BasedSchemaFields]
  | (BasedSchemaFieldShared & {
      type?: ''
      isRequired?: boolean // our own
      $ref: string // to mimic json schema will just load it in place (so only for setting)
    })

export type BasedSchemaType = {
  fields: {
    [name: string]: BasedSchemaField
  }
  title?: string
  description?: string
  prefix?: BasedSchemaTypePrefix
  examples?: any[]
  required?: string[]
  $defs?: { [key: string]: BasedSchemaField }
  // TODO: This is an option. Should be in another place
  $delete?: boolean
}

// this is the return value,, optional for insert
export type BasedSchema = {
  language: BasedSchemaLanguage
  translations?: BasedSchemaLanguage[]
  languageFallbacks?: Partial<
    Record<BasedSchemaLanguage, BasedSchemaLanguage[]>
  >
  root: BasedSchemaType
  // in our setup this is used as top level /$defs/[name]/
  // in our setup this is used as top level /types/[name]/$defs/[name]
  // #/$defs/name
  $defs: { [name: string]: BasedSchemaField }
  types: {
    [type: string]: BasedSchemaType
  }
  prefixToTypeMapping: {
    [prefix: string]: string
  }
}

export type BasedSchemaTypePartial = PartialDeep<BasedSchemaType>

export type BasedSchemaFieldPartial = PartialDeep<BasedSchemaField>

export type BasedSchemaPartial = PartialDeep<BasedSchema>

export type BasedSetTarget = {
  type: string
  $alias?: string
  $id?: string
  schema: BasedSchema
  $merge?: boolean
  $language?: BasedSchemaLanguage
  required: (number | string)[][]
  collected: BasedSchemaCollectProps[]
  errors: { code: ParseError; path: Path }[]
}

export type BasedSchemaCollectProps = ArgsClass<BasedSetTarget> & {
  root: ArgsClass<BasedSetTarget> & {
    typeSchema: BasedSchemaType
  }
}
