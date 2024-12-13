import { getPropType } from './parse/utils.js'

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

type QueryFn = Function
type PropValues = { type?: string; default?: any }
type Prop<V extends PropValues> = {
  required?: boolean
  title?: string | Record<string, string>
  description?: string | Record<string, string>
  path?: string
  query?: QueryFn
  role?: Role
  readOnly?: boolean
  examples?: string[]
} & V

type EnumItem = string | number | boolean

export type SchemaReferences = Prop<{
  type?: 'references'
  items: SchemaReference
}>

export type SchemaReferencesOneWay = Prop<{
  type?: 'references'
  items: SchemaReferenceOneWay
}>

export type SchemaText = Prop<{
  type: 'text'
  default?: Record<string, string>
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
}>

export type SchemaString = Prop<{
  type: 'string'
  default?: string
  maxBytes?: number
  max?: number
  min?: number
  mime?: Mime
  format?: StringFormat
  // multiline?: boolean
  // add level here as well
  compression?: 'none' | 'deflate'
}>

export type SchemaBinary = Prop<{
  type: 'binary'
  default?: ArrayBuffer
  maxBytes?: number
  mime?: Mime
  format?: StringFormat
}>

export type SchemaBoolean = Prop<{
  type: 'boolean'
  default?: boolean
}>

export type SchemaTimestamp = Prop<{
  type: 'timestamp'
  default?: number | Date
  on?: 'create' | 'update'
  display?: DateDisplay
}>

export type SchemaReferenceOneWay = Prop<{
  type?: 'reference'
  default?: string
  ref: string // | SchemaType
  mime?: Mime
}>

export type SchemaReference = Prop<{
  type?: 'reference'
  default?: string
  ref: string // | SchemaType
  prop: string
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
  default?: EnumItem
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
  | NumberType
  | EnumItem[]

type SetItems =
  | SchemaPropShorthand
  | SchemaTimestamp
  | SchemaBoolean
  | SchemaNumber
  | SchemaString
  | SchemaEnum

export type SchemaSet<ItemsType extends SetItems = SetItems> = Prop<{
  type?: 'set'
  default?: ItemsType extends { default } ? ItemsType['default'][] : undefined
  items: ItemsType
}>

type NonRefSchemaProps =
  | SchemaPropShorthand
  | SchemaTimestamp
  | SchemaBoolean
  | SchemaNumber
  | SchemaString
  | SchemaAlias
  | SchemaText
  | SchemaEnum
  | SchemaSet
  | SchemaBinary

export type SchemaProp<isStrict = false> =
  | SchemaReferencesWithQuery
  | SchemaReferenceWithQuery
  | NonRefSchemaProps
  | SchemaReferences
  | SchemaReference
  | SchemaObject
  | SchemaBinary

export type SchemaPropOneWay<isStrict = false> =
  | SchemaReferencesOneWay
  | SchemaReferenceOneWay
  | SchemaObjectOneWay
  | NonRefSchemaProps

export type SchemaAnyProp = SchemaPropOneWay | SchemaProp
export type SchemaHook = string | Function
export type SchemaProps<isStrict = false> = Record<string, SchemaProp<isStrict>>
export type StrictSchemaType = {
  hooks?: {
    create?: SchemaHook
    update?: SchemaHook
    delete?: SchemaHook
  }
  id?: number
  props: SchemaProps<true>
}

export type SchemaType<isStrict = false> = isStrict extends true
  ? StrictSchemaType
  : StrictSchemaType | SchemaProps

export type SchemaTypes<isStrict = false> = Record<string, SchemaType<isStrict>>
export type SchemaPropsOneWay<isStrict = false> = Record<
  `${Letter}${string}`,
  SchemaPropOneWay<isStrict>
>

type GenericSchema<isStrict = false> = {
  types?: SchemaTypes<isStrict>
  props?: SchemaPropsOneWay<isStrict>
  locales?: SchemaLocales
}

export type StrictSchema = GenericSchema<true>
export type Schema = GenericSchema<false> | StrictSchema

export type SchemaLocales = Record<
  string,
  {
    required?: boolean
    fallback?: string[]
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
  set: SchemaSet
  binary: SchemaBinary
} & Record<NumberType, SchemaNumber>

export type SchemaPropTypes = keyof SchemaPropTypeMap

export const isPropType = <T extends SchemaPropTypes>(
  type: T,
  prop: SchemaProp,
): prop is SchemaPropTypeMap[T] => {
  return getPropType(prop) === type
}
