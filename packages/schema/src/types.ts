import { getPropType } from './parse/utils.js'
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
  label?: Record<string, string>
  description?: Record<string, string>
  path?: string
  query?: QueryFn
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
}>

export type SchemaString = Prop<{
  type: 'string'
  default?: string
  maxBytes?: number
  max?: number
  min?: number
}>

export type SchemaBinary = Prop<{
  type: 'binary'
  default?: ArrayBuffer
  maxBytes?: number
}>

export type SchemaBoolean = Prop<{
  type: 'boolean'
  default?: boolean
}>

export type SchemaTimestamp = Prop<{
  type: 'timestamp'
  default?: number | Date
  on?: 'create' | 'update'
}>

export type SchemaReferenceOneWay = Prop<{
  type?: 'reference'
  default?: string
  ref: string
}>

export type SchemaReference = Prop<{
  type?: 'reference'
  default?: string
  ref: string
  prop: string
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

export type SchemaAlias = SchemaString & { type: 'alias' }

export type SchemaPropShorthand =
  | 'timestamp'
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

export type SchemaProp =
  | SchemaReferencesWithQuery
  | SchemaReferenceWithQuery
  | NonRefSchemaProps
  | SchemaReferences
  | SchemaReference
  | SchemaObject
  | SchemaBinary

export type SchemaPropOneWay =
  | SchemaReferencesOneWay
  | SchemaReferenceOneWay
  | SchemaObjectOneWay
  | NonRefSchemaProps

export type SchemaAnyProp = SchemaPropOneWay | SchemaProp
export type SchemaHook = string | Function
export type SchemaProps = Record<string, SchemaProp>
export type SchemaType = {
  hooks?: {
    create?: SchemaHook
    update?: SchemaHook
    delete?: SchemaHook
  }
  id?: number
  props: SchemaProps
}

export type SchemaTypes = Record<string, SchemaType>
export type SchemaPropsOneWay = Record<`${Letter}${string}`, SchemaPropOneWay>

export type Schema = {
  types?: SchemaTypes
  props?: SchemaPropsOneWay
  locales?: SchemaLocales
}

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
