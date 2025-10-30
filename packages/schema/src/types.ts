import { getPropType } from './parse/utils.js'
import type { LangName } from './lang.js'
import type { Validation } from './def/validation.js'

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
  'date-time-human-short',
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
  'password',
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
type PropValues = {
  type?: string
  default?: any
  validation?: Validation
}
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
  hooks?: SchemaPropHooks
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

export type HLLRegisterRepresentation = 'sparse' | 'dense'

export type SchemaCardinality = Prop<{
  type: 'cardinality'
  maxBytes?: number
  precision?: number
  mode?: HLLRegisterRepresentation
}>

type VectorDefaultType =
  | Int8Array
  | Uint8Array
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array
export type SchemaVectorBaseType = NumberType | 'float32' | 'float64'

export type SchemaVector = Prop<{
  type: 'vector'
  default?: VectorDefaultType
  /**
   * Number of elements in the vector.
   */
  size: number
  /**
   * Base type of the vector.
   * float64 == number
   */
  baseType?: SchemaVectorBaseType
}>

export type SchemaColvec = Prop<{
  type: 'colvec'
  default?: VectorDefaultType
  /**
   * Number of elements in the vector.
   */
  size: number
  /**
   * Base type of the vector.
   * float64 == number
   */
  baseType?: SchemaVectorBaseType
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
export type SchemaProps<isStrict = false> = Record<
  AllowedKey,
  SchemaProp<isStrict>
> & { id?: never }

// TODO: export these types in a pkg (not db => circular!)
type BasedDbQuery = any
type Operator = string

export type SchemaHooks = {
  create?: (payload: Record<string, any>) => void | Record<string, any>
  update?: (payload: Record<string, any>) => void | Record<string, any>
  read?: (result: Record<string, any>) => void | null | Record<string, any>
  search?: (query: BasedDbQuery, fields: Set<string>) => void
  include?: (
    query: BasedDbQuery,
    fields: Map<
      string,
      {
        field: string
        opts?: any // temp this type
      }
    >,
  ) => void
  filter?: (
    query: BasedDbQuery,
    field: string,
    operator: Operator,
    value: any,
  ) => void
  groupBy?: (query: BasedDbQuery, field: string) => void
  aggregate?: (query: BasedDbQuery, fields: Set<string>) => void
}

export type SchemaPropHooks = {
  create?: (value: any, payload: Record<string, any>) => any
  update?: (value: any, payload: Record<string, any>) => any
  read?: (value: any, result: Record<string, any>) => any
  aggregate?: (query: BasedDbQuery, fields: Set<string>) => void
  search?: (query: BasedDbQuery, fields: Set<string>) => void
  groupBy?: (query: BasedDbQuery, field: string) => void
  filter?: (
    query: BasedDbQuery,
    field: string,
    operator: Operator,
    value: any,
  ) => void
  include?: (
    query: BasedDbQuery,
    fields: Map<
      string,
      {
        field: string
        opts?: any // temp this type
      }
    >,
  ) => void
}

type GenericSchemaType<isStrict = false> = {
  hooks?: SchemaHooks
  id?: number
  blockCapacity?: number
  ringMaxIds?: number
  insertOnly?: boolean
  partial?: boolean
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

type MigrateFn = (
  node: Record<string, any>,
) => Record<string, any> | [string, Record<string, any>]

export type MigrateFns = Record<string, MigrateFn>

type GenericSchema<isStrict = false> = {
  version?: string
  types?: SchemaTypes<isStrict>
  props?: SchemaPropsOneWay<isStrict>
  locales?: Partial<SchemaLocales>
  defaultTimezone?: string
  migrations?: {
    version: string
    migrate: MigrateFns
  }[]
}

export type StrictSchema = GenericSchema<true>
export type NonStrictSchema = GenericSchema<false>
export type Schema = NonStrictSchema | StrictSchema

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
