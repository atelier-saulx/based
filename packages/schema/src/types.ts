type Prop<Values extends { type?: string; defaultValue?: any }> = {
  required?: boolean
  label?: Record<string, string>
  description?: Record<string, string>
} & Values

type SetItem<rootOrEdgeProps = false> =
  | SchemaNumber
  | SchemaReference<rootOrEdgeProps>
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
  prop: string
  edge?: {
    props: SchemaProps<true>
  }
}>

export type SchemaReference<rootOrEdgeProps = false> =
  rootOrEdgeProps extends true ? Omit<Reference, 'prop' | 'edge'> : Reference

export type SchemaEnum = Prop<{
  type?: 'enum'
  defaultValue?: EnumItem
  enum: EnumItem[]
}>

export type SchemaSet<rootOrEdgeProps = false> = Set<SetItem<rootOrEdgeProps>>

export type SchemaProp<rootOrEdgeProps = false> =
  | SchemaBoolean
  | SchemaTimestamp
  | SchemaNumber
  | SchemaString
  | SchemaText
  | SchemaSet<rootOrEdgeProps>
  | SchemaEnum
  | SchemaReference<rootOrEdgeProps>

export type SchemaType = {
  props: Record<string, SchemaProp>
}
export type SchemaProps<rootOrEdgeProps = false> = Record<
  string,
  SchemaProp<rootOrEdgeProps>
>
export type SchemaTypes = Record<string, SchemaType>
export type Schema = {
  types?: SchemaTypes
  props?: SchemaProps<true>
}
