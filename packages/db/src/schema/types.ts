import { BasedNode } from '../basedNode/index.js'

// Reserved fields
// 255: single ref in include
// 254: multi ref in include
// 253: to read multi refs in responses better to avoid
// 0: main buffer

// Dont change the numbers!
export const TYPE_INDEX_MAP = {
  timestamp: 1,
  created: 2,
  updated: 3,
  number: 4,
  uint32: 5,
  boolean: 9,
  enum: 10,
  string: 11,
  reference: 13,
  references: 14,
  microbuffer: 17,
  // ------- internal only
  id: 0,
} as const

export type InternalSchemaProp = keyof typeof TYPE_INDEX_MAP

export type TypeIndex = (typeof TYPE_INDEX_MAP)[InternalSchemaProp]

export type PropDefEdge = {
  typeIndex: TypeIndex
  len: number
  prop: number // (0-250)
  name: string
  // ref info later
}

export type PropDef = {
  __isPropDef: true
  prop: number // (0-250)
  typeIndex: TypeIndex
  seperate: boolean
  path: string[]
  start: number
  len: number
  inverseTypeName?: string
  inversePropName?: string
  inverseTypeId?: number
  inversePropNumber?: number
  reverseEnum?: { [key: string]: number }
  edges?: {
    [key: string]: PropDefEdge
  }
  reverseEdges?: {
    [prop: string]: PropDefEdge
  }
  enum?: any[]
}

export type SchemaPropTree = { [key: string]: SchemaPropTree | PropDef }

export type SchemaTypeDef = {
  cnt: number
  checksum: number
  total: number
  type: string
  lastId: number
  mainLen: number
  buf: Buffer
  propNames: Buffer
  props: {
    // path including .
    [key: string]: PropDef
  }
  id: number
  idUint8: Uint8Array
  seperate: PropDef[]
  tree: SchemaPropTree
  responseCtx: BasedNode
  hasStringProp: boolean
  stringPropsSize: number
  stringProps: Buffer // size will be max field
  stringPropsCurrent: Buffer // size will be max field
  stringPropsLoop: PropDef[]
}

export const SIZE_MAP: Record<InternalSchemaProp, number> = {
  timestamp: 8, // 64bit
  created: 8,
  updated: 8,
  // double-precision 64-bit binary format IEEE 754 value
  number: 8, // 64bit
  // float32: 8,
  // float64: 8,
  // int8: 1,
  // uint8: 1,
  // int16: 2,
  // uint16: 2,
  // int32: 4,
  uint32: 4,
  boolean: 1, // 1bit (6 bits overhead)
  reference: 0, // seperate
  enum: 1, // enum
  string: 0, // var length fixed length will be different
  references: 0,
  microbuffer: 0,
  id: 4,
}

const reverseMap: any = {}
for (const k in TYPE_INDEX_MAP) {
  reverseMap[TYPE_INDEX_MAP[k]] = k
}

export const REVERSE_TYPE_INDEX_MAP: Record<TypeIndex, InternalSchemaProp> =
  reverseMap

export const ID_FIELD_DEF: PropDef = {
  typeIndex: TYPE_INDEX_MAP['id'],
  seperate: true,
  path: ['id'],
  start: 0,
  prop: 0,
  len: 4,
  __isPropDef: true,
}

export const EMPTY_MICRO_BUFFER: PropDef = {
  typeIndex: TYPE_INDEX_MAP['microbuffer'],
  seperate: true,
  path: [''],
  start: 0,
  prop: 0,
  len: 1,
  __isPropDef: true,
}

export const getPropTypeName = (propType: TypeIndex): InternalSchemaProp => {
  return REVERSE_TYPE_INDEX_MAP[propType]
}

export const isPropDef = (prop: any): prop is PropDef => {
  if ('__isPropDef' in prop && prop.__isPropDef === true) {
    return true
  }
  return false
}

export const isType = (prop: PropDef, type: InternalSchemaProp): boolean => {
  return REVERSE_TYPE_INDEX_MAP[prop.typeIndex] === type
}
