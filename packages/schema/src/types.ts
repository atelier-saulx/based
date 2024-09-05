type Prop<Values extends { type?: string; defaultValue?: any }> = {
  required?: boolean
  label?: Record<string, string>
  description?: Record<string, string>
} & Values

type SetItem =
  | SchemaNumber
  | SchemaReference
  | SchemaString
  | SchemaTimestamp
  | SchemaBoolean

type Set<ItemsType extends SetItem> = Prop<{
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
  inverseProp: string
}>

export type SchemaEnum = Prop<{
  type?: 'enum'
  defaultValue?: EnumItem
  enum: EnumItem[]
}>

export type SchemaSet = Set<SetItem>

export type SchemaProp =
  | SchemaBoolean
  | SchemaTimestamp
  | SchemaNumber
  | SchemaString
  | SchemaText
  | SchemaReference
  | SchemaSet
  | SchemaEnum

export type SchemaType = {
  props: Record<string, SchemaProp>
}
export type SchemaProps = Record<string, SchemaProp>
export type SchemaTypes = Record<string, SchemaType>
export type Schema = {
  types?: SchemaTypes
  props?: SchemaProps
}
