type Prop<Values extends { type?: string; defaultValue?: any }> = {
  required?: boolean
  label?: Record<string, string>
  description?: Record<string, string>
} & Values

type SetItem<inRootProps = false> =
  | SchemaNumber
  | SchemaReference<inRootProps>
  | SchemaString
  | SchemaTimestamp
  | SchemaBoolean

type Set<ItemsType extends SetItem<boolean>> = Prop<{
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

type Reference = Prop<{
  type?: 'reference'
  defaultValue?: string
  ref: string
  inverseProp: string
}>

export type SchemaReference<inRootProps = false> = inRootProps extends true
  ? Omit<Reference, 'inverseProp'>
  : Reference

export type SchemaEnum = Prop<{
  type?: 'enum'
  defaultValue?: EnumItem
  enum: EnumItem[]
}>

export type SchemaSet<inRootProps = false> = Set<SetItem<inRootProps>>

export type SchemaProp<inRootProps = false> =
  | SchemaBoolean
  | SchemaTimestamp
  | SchemaNumber
  | SchemaString
  | SchemaText
  | SchemaSet<inRootProps>
  | SchemaEnum
  | SchemaReference<inRootProps>

export type SchemaType = {
  props: Record<string, SchemaProp>
}
export type SchemaProps<inRootProps = false> = Record<
  string,
  SchemaProp<inRootProps>
>
export type SchemaTypes = Record<string, SchemaType>
export type Schema = {
  types?: SchemaTypes
  props?: SchemaProps<true>
}
