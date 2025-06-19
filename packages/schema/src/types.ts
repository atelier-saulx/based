import { getPropType } from './parse/utils.js'
import { LangName } from './lang.js'
import { Validation } from './def/validation.js'

type Role = 'title' | 'source' | 'media' | string

export const numberDisplays = [
  'short',
  'human',
  'ratio',
  'bytes',
  'euro',
  'dollar',
  'pound',
  'meter',
] as const
export const dateDisplays = [
  'date',
  'date-time',
  'date-time-text',
  'date-time-human',
  'time',
  'time-precise',
] as const
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
  'strongPassword',
  'surrogatePair',
  'taxID',
  'typescript',
  'uppercase',
  'URL',
  'UUID',
  'VAT',

  // TODO: for discussion
  'multiline',
] as const

type DateDisplay = (typeof dateDisplays)[number]
type NumberDisplay = (typeof numberDisplays)[number] | `round-${number}`
type StringFormat = (typeof stringFormats)[number]

type MimeString =
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
  | `${string}/${string}` // this is overriding the previous

type Mime = MimeString | MimeString[]

type Letter =
  | 'A'
  | 'B'
  | 'C'
  | 'D'
  | 'E'
  | 'F'
  | 'G'
  | 'H'
  | 'I'
  | 'J'
  | 'K'
  | 'L'
  | 'M'
  | 'N'
  | 'O'
  | 'P'
  | 'Q'
  | 'R'
  | 'S'
  | 'T'
  | 'U'
  | 'V'
  | 'W'
  | 'X'
  | 'Y'
  | 'Z'
  | 'a'
  | 'b'
  | 'c'
  | 'd'
  | 'e'
  | 'f'
  | 'g'
  | 'h'
  | 'i'
  | 'j'
  | 'k'
  | 'l'
  | 'm'
  | 'n'
  | 'o'
  | 'p'
  | 'q'
  | 'r'
  | 's'
  | 't'
  | 'u'
  | 'v'
  | 'w'
  | 'x'
  | 'y'
  | 'z'

type AllowedKey = `${Letter}${string}`
type QueryFn = Function
type PropValues = { type?: string; default?: any; validation?: Validation }
type Prop<V extends PropValues> = {
  required?: boolean
  title?: string | Record<string, string>
  description?: string | Record<string, string>
  path?: string
  query?: QueryFn
  role?: Role
  readOnly?: boolean
  examples?: string[]
  validation?: Validation
} & V

type EnumItem = string | number | boolean
type NeverInItems = { required?: never }

export type SchemaReferences = Prop<{
  type?: 'references'
  default?: number[]
  items: SchemaReference & NeverInItems
}>

export type SchemaReferencesOneWay = Prop<{
  type?: 'references'
  default?: number[]
  items: SchemaReferenceOneWay & NeverInItems
}>

export type SchemaText = Prop<{
  type: 'text'
  default?: Record<string, string>
  format?: StringFormat
  compression?: 'none' | 'deflate'
}>

type NumberType =
  | 'number'
  | 'int8'
  | 'uint8'
  | 'int16'
  | 'uint16'
  | 'int32'
  | 'uint32'

export type SchemaNumber = Prop<{
  type: NumberType
  default?: number
  min?: number
  max?: number
  step?: number | 'any'
  display?: NumberDisplay
  history?: {
    interval: 'year' | 'month' | 'week' | 'day' | 'hour' | 'minute' | 'second'
  }
}>

export type SchemaString = Prop<{
  type: 'string'
  default?: string
  maxBytes?: number
  max?: number
  min?: number
  mime?: Mime
  format?: StringFormat
  compression?: 'none' | 'deflate'
}>

export type SchemaBinary = Prop<{
  type: 'binary'
  default?: Uint8Array
  maxBytes?: number
  mime?: Mime
  format?: StringFormat
}>

export type SchemaJson = Prop<{
  type: 'json'
  default?: Record<string, any> | null
}>

export type SchemaBoolean = Prop<{
  type: 'boolean'
  default?: boolean
}>

export type SchemaCardinality = Prop<{
  type: 'cardinality'
  // default?: string[]
  maxBytes?: number // should be fixed
  mime?: Mime // TODO: check if this is correct
  format?: NumberDisplay // when queried should return the count
}>

export type SchemaVector = Prop<{
  type: 'vector'
  default?: Float32Array
  size: number
}>

export type SchemaColvec = Prop<{
  type: 'colvec'
  default?: Float32Array
  size: number
  // TODO Add support for other comp types
}>

export type SchemaTimestamp = Prop<{
  type: 'timestamp'
  default?: number | Date | string
  on?: 'create' | 'update'
  display?: DateDisplay
  min?: number | string
  max?: number | string
  step?: number | 'any' | string
}>

export type SchemaReferenceOneWay = Prop<{
  type?: 'reference'
  default?: number
  ref: string
  mime?: Mime
}>

export type SchemaReference = Prop<{
  type?: 'reference'
  default?: number
  ref: string
  prop: string
  dependent?: boolean
  mime?: Mime
}> &
  Record<`$${string}`, SchemaPropOneWay>

export type SchemaObject = Prop<{
  type?: 'object'
  props: SchemaProps
}>

export type SchemaObjectOneWay = Prop<{
  type?: 'object'
  props: SchemaPropsOneWay
}>

export type SchemaReferenceWithQuery = SchemaReferenceOneWay & {
  query: QueryFn
}
export type SchemaReferencesWithQuery = SchemaReferencesOneWay & {
  query: QueryFn
}

export type SchemaEnum = Prop<{
  type?: 'enum'
  default?: EnumItem | undefined
  enum: EnumItem[]
}>

export type SchemaAlias = Omit<SchemaString, 'type'> & { type: 'alias' }

export type SchemaPropShorthand =
  | 'timestamp'
  | 'binary'
  | 'boolean'
  | 'string'
  | 'alias'
  | 'text'
  | 'json'
  | 'cardinality'
  | NumberType
  | EnumItem[]

type SetItems<isStrict = false> =
  | SchemaTimestamp
  | SchemaBoolean
  | SchemaNumber
  | SchemaString
  | SchemaEnum
  | (isStrict extends true
      ? never
      : 'timestamp' | 'binary' | 'boolean' | 'string' | NumberType | EnumItem[])

export type SchemaSet<ItemsType extends SetItems = SetItems> = Prop<{
  type?: 'set'
  default?: ItemsType extends { default } ? ItemsType['default'][] : undefined
  items: ItemsType & NeverInItems
}>

type NonRefSchemaProps<isStrict = false> =
  | SchemaTimestamp
  | SchemaBoolean
  | SchemaNumber
  | SchemaString
  | SchemaAlias
  | SchemaText
  | SchemaEnum
  | SchemaJson
  | SchemaBinary
  | SchemaCardinality
  | SchemaVector
  | SchemaColvec
  | (isStrict extends true
      ? SchemaSet<SetItems<true>>
      : SchemaPropShorthand | SchemaSet)

export type SchemaProp<isStrict = false> =
  | SchemaReferencesWithQuery
  | SchemaReferenceWithQuery
  | NonRefSchemaProps<isStrict>
  | SchemaReferences
  | SchemaReference
  | SchemaObject
  | SchemaBinary

export type SchemaPropOneWay<isStrict = false> =
  | SchemaReferencesOneWay
  | SchemaReferenceOneWay
  | SchemaObjectOneWay
  | NonRefSchemaProps<isStrict>

export type SchemaAnyProp = SchemaPropOneWay | SchemaProp
export type SchemaHook = string | Function
export type SchemaProps<isStrict = false> = Record<
  AllowedKey,
  SchemaProp<isStrict>
> & { id?: never }

type GenericSchemaType<isStrict = false> = {
  hooks?: {
    create?: SchemaHook
    update?: SchemaHook
    delete?: SchemaHook
  }
  id?: number
  blockCapacity?: number
  insertOnly?: boolean
  props: SchemaProps<isStrict>
}

export type StrictSchemaType = GenericSchemaType<true>
export type SchemaType<isStrict = false> = isStrict extends true
  ? StrictSchemaType
  :
      | StrictSchemaType
      | GenericSchemaType<false>
      | (SchemaProps & { props?: never })

export type SchemaTypeName = Exclude<string, '_root'>
export type SchemaTypes<isStrict = false> = Record<
  SchemaTypeName,
  SchemaType<isStrict>
> & { _root?: never }

export type SchemaPropsOneWay<isStrict = false> = Record<
  AllowedKey,
  SchemaPropOneWay<isStrict>
> & { id?: never }

type GenericSchema<isStrict = false> = {
  types?: SchemaTypes<isStrict>
  props?: SchemaPropsOneWay<isStrict>
  locales?: Partial<SchemaLocales>
}

export type StrictSchema = GenericSchema<true>
export type Schema = GenericSchema<false> | StrictSchema

export type SchemaLocales = Record<
  LangName,
  | true
  | {
      required?: boolean
      fallback?: LangName // not multiple - 1 is enough else it becomes too complex
    }
>

export type SchemaPropTypeMap = {
  references: SchemaReferences
  timestamp: SchemaTimestamp
  reference: SchemaReference
  boolean: SchemaBoolean
  string: SchemaString
  object: SchemaObject
  alias: SchemaAlias
  enum: SchemaEnum
  text: SchemaText
  json: SchemaJson
  set: SchemaSet
  binary: SchemaBinary
  cardinality: SchemaCardinality
  vector: SchemaVector
  colvec: SchemaColvec
} & Record<NumberType, SchemaNumber>

export type SchemaPropTypes = keyof SchemaPropTypeMap

export const isPropType = <T extends SchemaPropTypes>(
  type: T,
  prop: SchemaProp,
): prop is SchemaPropTypeMap[T] => {
  return getPropType(prop) === type
}

export const MAX_ID = 4294967295
export const MIN_ID = 1
