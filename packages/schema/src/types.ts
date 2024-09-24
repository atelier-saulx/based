import { getPropType } from './parseSchema/utils.js'

type QueryFn = Function
type PropValues = { type?: string; default?: any }
type Prop<V extends PropValues> = {
  required?: boolean
  label?: Record<string, string>
  description?: Record<string, string>
  path?: string
  query?: QueryFn
} & V

type PropWithShorthand<V extends PropValues> = V['type'] | Prop<V>

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

export type SchemaNumber = Prop<{
  type: 'number'
  default?: number
  min: number
  max: number
  step: number | 'any'
}>

export type SchemaExactNumber = Prop<{
  type:
    | 'float32'
    | 'float64'
    | 'int8'
    | 'uint8'
    | 'int16'
    | 'uint16'
    | 'int32'
    | 'uint32'
  default?: number
  min?: number
  max?: number
  step?: number | 'any'
}>

export type SchemaString = PropWithShorthand<{
  type: 'string'
  default?: string
  maxBytes?: number
  max?: number
  min?: number
}>

export type SchemaBoolean = Prop<{
  type: 'boolean'
  default?: boolean
}>

export type SchemaTimestamp = Prop<{
  type: 'timestamp'
  default?: number | Date
}>

export type SchemaReference = Prop<{
  type?: 'reference'
  default?: string
  ref: string
  prop: string
  edge?: SchemaObjectOneWay
}>

export type SchemaObject = Prop<{
  type?: 'object'
  props: SchemaProps
}>

export type SchemaObjectOneWay = Prop<{
  type?: 'object'
  props: SchemaRootProps
}>

export type SchemaReferenceOneWay = Omit<SchemaReference, 'prop' | 'edge'>
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

export type SchemaShorthandProp = 'string' | 'boolean'

type SetItems =
  | SchemaNumber
  | SchemaString
  | SchemaTimestamp
  | SchemaBoolean
  | SchemaEnum
  | SchemaShorthandProp

export type SchemaSet<ItemsType extends SetItems = SetItems> = Prop<{
  type?: 'set'
  default?: ItemsType extends { default } ? ItemsType['default'][] : undefined
  items: ItemsType
}>

type NonRefSchemaProps =
  | SchemaBoolean
  | SchemaTimestamp
  | SchemaNumber
  | SchemaString
  | SchemaText
  | SchemaEnum
  | SchemaExactNumber
  | SchemaSet

export type SchemaProp =
  | NonRefSchemaProps
  | SchemaReference
  | SchemaReferenceWithQuery
  | SchemaReferences
  | SchemaReferencesWithQuery
  | SchemaObject

export type SchemaRootProp =
  | NonRefSchemaProps
  | SchemaReferenceOneWay
  | SchemaReferencesOneWay
  | SchemaObjectOneWay

export type SchemaAnyProp = SchemaRootProp | SchemaProp
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
export type SchemaRootProps = Record<
  string,
  SchemaRootProp | SchemaShorthandProp
>

export type Schema = {
  types?: SchemaTypes
  props?: SchemaRootProps
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
  string: SchemaString
  number: SchemaNumber
  object: SchemaObject
  boolean: SchemaBoolean
  timestamp: SchemaTimestamp
  enum: SchemaEnum
  text: SchemaText
  set: SchemaSet
  reference: SchemaReference
  references: SchemaReferences
} & Record<SchemaExactNumber['type'], SchemaExactNumber>

export type SchemaPropTypes = keyof SchemaPropTypeMap
export const isPropType = <T extends SchemaPropTypes>(
  type: T,
  prop: SchemaProp,
): prop is SchemaPropTypeMap[T] => {
  return getPropType(prop) === type
}
