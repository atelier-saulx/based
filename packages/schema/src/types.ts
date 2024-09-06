type Prop<Values extends { type?: string; defaultValue?: any }> = {
  required?: boolean
  label?: Record<string, string>
  description?: Record<string, string>
} & Values

type NonRefSetItems =
  | SchemaNumber
  | SchemaString
  | SchemaTimestamp
  | SchemaBoolean

type Set<
  ItemsType extends NonRefSetItems | SchemaReference | SchemaOneWayReference,
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

type SchemaOneWayReference = Omit<SchemaReference, 'prop' | 'edge'>

export type SchemaEnum = Prop<{
  type?: 'enum'
  defaultValue?: EnumItem
  enum: EnumItem[]
}>

export type SchemaSet = Set<NonRefSetItems | SchemaReference>
export type SchemaRootSet = Set<NonRefSetItems | SchemaOneWayReference>

type NonRefSchemaProps =
  | SchemaBoolean
  | SchemaTimestamp
  | SchemaNumber
  | SchemaString
  | SchemaText
  | SchemaSet
  | SchemaEnum

export type SchemaProp = NonRefSchemaProps | SchemaReference
export type SchemaAllProps =
  | NonRefSchemaProps
  | SchemaOneWayReference
  | SchemaReference

export type SchemaType = {
  props: Record<string, SchemaProp>
}
export type SchemaProps = Record<string, SchemaProp>
export type SchemaTypes = Record<string, SchemaType>
export type Schema = {
  types?: SchemaTypes
  props?: Record<string, NonRefSchemaProps | SchemaOneWayReference>
}
