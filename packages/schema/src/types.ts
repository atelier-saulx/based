type QueryFn = Function
type Prop<Values extends { type?: string; defaultValue?: any }> = {
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
  defaultValue?: ItemsType['defaultValue']
  items: ItemsType
}>

type EnumItem = string | number | boolean

export type SchemaText = Prop<{
  type: 'text'
  defaultValue?: Record<string, string>
}>

export type SchemaNumber = Prop<{
  type: 'number'
  defaultValue?: number
  min: number
  max: number
  step: number | 'any'
}>

export type SchemaString = Prop<{
  type: 'string'
  defaultValue?: string
}>

export type SchemaBoolean = Prop<{
  type: 'boolean'
  defaultValue?: boolean
}>

export type SchemaTimestamp = Prop<{
  type: 'timestamp'
  defaultValue?: number | Date
}>

export type SchemaReference = Prop<{
  type?: 'reference'
  defaultValue?: string
  ref: string
  prop: string
  edge?: {
    props: SchemaProps
  }
}>

export type SchemaReferenceOneWay = Omit<SchemaReference, 'prop' | 'edge'>
export type SchemaReferenceQuery = SchemaReferenceOneWay & { query: QueryFn }

export type SchemaEnum = Prop<{
  type?: 'enum'
  defaultValue?: EnumItem
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

export type SchemaProp = NonRefSchemaProps | SchemaSet | SchemaReference
export type SchemaRootProp =
  | NonRefSchemaProps
  | SchemaSetOneWay
  | SchemaReferenceOneWay

export type SchemaAnyProp = SchemaRootProp | SchemaProp

export type SchemaType = {
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
