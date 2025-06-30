import { SchemaProp, SchemaType } from '@based/schema'

export type PropVisual = {
  prop: SchemaProp
  x: number
  y: number
  w: number
  h: number
  reverseType?: string
  many: boolean
  reverseProp?: string
  leftAnchor?: number
  rightAnchor?: number
  created: boolean
  name: string
  isRef: boolean
  type: TypeVisual
}

export type Root = {
  x: number
  y: number
  w: number
  h: number
  used?: boolean
  right?: Node
  down?: Node
}

export type TypeVisual = {
  schemaType: SchemaType
  type: string
  x: number
  y: number
  w: number
  h: number
  fit: any
  props: {
    [path: string]: PropVisual
  }
  used?: boolean
  right?: Node
  down?: Node
}

export type Node = TypeVisual | Root

export type LineSegment = 'h' | 'v' | 'lt' | 'rt' | 'rb' | 'lb' | 'e'

export type FilterOps = { filter?: string }
