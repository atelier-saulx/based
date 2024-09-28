import { BasedNode } from '../basedNode/index.js'

// Reserved fields
// 255: single ref in include
// 254: multi ref in include
// 253: to read multi refs in responses better to avoid
// 0: main buffer

// TODO make nice CONSTS

// Dont change the numbers!
export const BOOLEAN = 9
export const CREATED = 2
export const ENUM = 10
export const ID = 0
export const INT16 = 20
export const INT32 = 22
export const INT8 = 18
export const MICROBUFFER = 17
export const NUMBER = 4
export const REFERENCE = 13
export const REFERENCES = 14
export const STRING = 11
export const TIMESTAMP = 1
export const UINT16 = 21
export const UINT32 = 5
export const UINT8 = 19
export const UPDATED = 3

const TYPE_INDEX_MAP = {
  microbuffer: MICROBUFFER,
  references: REFERENCES,
  reference: REFERENCE,
  timestamp: TIMESTAMP,
  boolean: BOOLEAN,
  created: CREATED,
  updated: UPDATED,
  number: NUMBER,
  string: STRING,
  uint16: UINT16,
  uint32: UINT32,
  int16: INT16,
  int32: INT32,
  uint8: UINT8,
  enum: ENUM,
  int8: INT8,
  id: ID,
}

export type InternalSchemaProp = keyof typeof TYPE_INDEX_MAP

export type TypeIndex = (typeof TYPE_INDEX_MAP)[InternalSchemaProp]

export type PropDef = {
  __isPropDef: true
  prop: number // (0-250)
  typeIndex: TypeIndex
  separate: boolean
  path: string[]
  start: number
  len: number
  inverseTypeName?: string
  inversePropName?: string
  inverseTypeId?: number
  inversePropNumber?: number
  enum?: any[]
  reverseEnum?: { [key: string]: number }
  edgesTotalLen?: number
  edges?: {
    [key: string]: PropDefEdge
  }
  reverseEdges?: {
    [prop: string]: PropDefEdge
  }
}

export type PropDefEdge = Partial<PropDef> & {
  __isPropDef: true
  typeIndex: TypeIndex
  len: number
  prop: number // (0-250)
  name: string
  edgesTotalLen?: number
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
  separate: PropDef[]
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
  int8: 1,
  uint8: 1,
  int16: 2,
  uint16: 2,
  int32: 4,
  uint32: 4,
  boolean: 1,
  reference: 0, // separate
  enum: 1, // enum
  string: 0, // separate
  references: 0, // separate
  microbuffer: 0, // separate
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
  separate: true,
  path: ['id'],
  start: 0,
  prop: 0,
  len: 4,
  __isPropDef: true,
}

export const EMPTY_MICRO_BUFFER: PropDef = {
  typeIndex: TYPE_INDEX_MAP['microbuffer'],
  separate: true,
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
