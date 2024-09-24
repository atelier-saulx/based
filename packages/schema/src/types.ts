type QueryFn = Function
type Prop<Values extends { type?: string; default?: any }> = {
  required?: boolean
  label?: Record<string, string>
  description?: Record<string, string>
  path?: string
  query?: QueryFn
} & Values

type NonRefSetItems =
  | SchemaNumber
  | SchemaString
  | SchemaTimestamp
  | SchemaBoolean

type Set<
  ItemsType extends NonRefSetItems | SchemaReference | SchemaReferenceOneWay,
> = Prop<{
  type?: 'set'
  default?: ItemsType['default']
  items: ItemsType
}>

type EnumItem = string | number | boolean

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

export type SchemaString = Prop<{
  type: 'string'
  default?: string
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
  edge?: SchemaRootObject
}>

export type SchemaObject = Prop<{
  type?: 'object'
  props: SchemaProps
}>

export type SchemaRootObject = Prop<{
  type?: 'object'
  props: SchemaRootProps
}>

export type SchemaReferenceOneWay = Omit<SchemaReference, 'prop' | 'edge'>
export type SchemaReferenceQuery = SchemaReferenceOneWay & { query: QueryFn }

export type SchemaEnum = Prop<{
  type?: 'enum'
  default?: EnumItem
  enum: EnumItem[]
}>

export type SchemaSetQuery = Set<SchemaReferenceOneWay> & { query: QueryFn }
export type SchemaSet = Set<NonRefSetItems | SchemaReference> | SchemaSetQuery
export type SchemaSetOneWay = Set<NonRefSetItems | SchemaReferenceOneWay>

type NonRefSchemaProps =
  | SchemaBoolean
  | SchemaTimestamp
  | SchemaNumber
  | SchemaString
  | SchemaText
  | SchemaEnum
  | SchemaExactNumber

export type SchemaProp =
  | NonRefSchemaProps
  | SchemaSet
  | SchemaReference
  | SchemaObject
export type SchemaRootProp =
  | NonRefSchemaProps
  | SchemaSetOneWay
  | SchemaReferenceOneWay
  | SchemaRootObject

export type SchemaAnyProp = SchemaRootProp | SchemaProp

export type SchemaHook = string | Function
export type SchemaType = {
  hooks?: {
    create: SchemaHook
    update: SchemaHook
    delete: SchemaHook
  }
  props: Record<string, SchemaProp>
}

export type SchemaProps = Record<string, SchemaProp>
export type SchemaTypes = Record<string, SchemaType>
export type SchemaRootProps = Record<string, SchemaRootProp>

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
