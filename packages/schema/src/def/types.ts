import type { LangCode, SchemaHooks, SchemaLocales } from '../index.js'
import { Validation } from './validation.js'
import {
  ALIAS,
  ALIASES,
  BINARY,
  BOOLEAN,
  CARDINALITY,
  COLVEC,
  ENUM,
  INT16,
  INT32,
  INT8,
  JSON,
  MICRO_BUFFER,
  NULL,
  NUMBER,
  OBJECT,
  REFERENCE,
  REFERENCES,
  STRING,
  TEXT,
  TIMESTAMP,
  UINT16,
  UINT32,
  UINT8,
  VECTOR,
  TypeIndex,
  VectorBaseType,
  ID,
} from './typeIndexes.js'

export * from './typeIndexes.js'

export const TYPE_INDEX_MAP: Record<string, TypeIndex> = {
  alias: ALIAS,
  aliases: ALIASES,
  microbuffer: MICRO_BUFFER,
  references: REFERENCES,
  reference: REFERENCE,
  timestamp: TIMESTAMP,
  boolean: BOOLEAN,
  number: NUMBER,
  string: STRING,
  text: TEXT,
  uint16: UINT16,
  uint32: UINT32,
  int16: INT16,
  int32: INT32,
  uint8: UINT8,
  enum: ENUM,
  int8: INT8,
  id: NULL,
  binary: BINARY,
  vector: VECTOR,
  cardinality: CARDINALITY,
  json: JSON,
  object: OBJECT,
  colvec: COLVEC,
}

export const enum numberTypes {
  number = NUMBER,
  uint16 = UINT16,
  uint32 = UINT32,
  int16 = INT16,
  int32 = INT32,
  uint8 = UINT8,
  int8 = INT8,
  cardinality = CARDINALITY,
}

export type InternalSchemaProp = keyof typeof TYPE_INDEX_MAP

export type PropDef = {
  __isPropDef: true
  prop: number // (0-250)
  typeIndex: TypeIndex
  separate: boolean
  path: string[]
  start: number
  len: number // bytes or count
  inverseTypeName?: string
  inversePropName?: string
  // 0 == none , 1 == standard deflate
  compression?: 0 | 1
  inverseTypeId?: number
  inversePropNumber?: number
  enum?: any[]
  dependent?: boolean
  // default here?
  validation: Validation
  default: any
  // vectors
  vectorBaseType?: VectorBaseType
  vectorSize?: number
  // edge stuff
  edgeMainLen?: 0
  hasDefaultEdges?: boolean
  reverseEnum?: { [key: string]: number }
  edgesSeperateCnt?: number
  edges?: {
    [key: string]: PropDefEdge
  }
  reverseSeperateEdges?: {
    [prop: string]: PropDefEdge
  }
  reverseMainEdges?: {
    [start: string]: PropDefEdge
  }
  edgeMainEmpty?: Uint8Array
  __isEdge?: boolean
  // Schema stuff
  max?: any
  min?: any
  step?: any
}

export type PropDefEdge = Partial<PropDef> & {
  __isPropDef: true
  typeIndex: TypeIndex
  len: number
  prop: number // (0-250)
  name: string
  edgesTotalLen?: number
  __isEdge: true
}

export type PropDefAggregate = Partial<PropDef> & {
  __isPropDef: true
  typeIndex: TypeIndex
  len: number
  prop: number // (0-250)
  name: string
}

export type SchemaPropTree = { [key: string]: SchemaPropTree | PropDef }

export type SchemaSortUndefinedHandler = {
  size: number // number of text fields
  buffer: Uint8Array
  bufferTmp: Uint8Array // Gets reused in modify to avoid extra Alloc
  props: PropDef[]
}

export const BLOCK_CAPACITY_MIN = 1025
export const BLOCK_CAPACITY_MAX = 2147483647
export const BLOCK_CAPACITY_DEFAULT = 100_000

export type SchemaTypeDef = {
  cnt: number
  checksum: number
  type: string
  lastId: number
  blockCapacity: number
  mainLen: number
  insertOnly: boolean // delete not allowed
  partial: boolean // only active block(s) should be loaded in-mem
  buf: Uint8Array
  propNames: Uint8Array
  props: {
    [path: string]: PropDef
  }
  reverseProps: {
    [field: string]: PropDef
  }
  id: number // u16 number
  idUint8: Uint8Array
  separate: PropDef[]
  main: {
    [start: string]: PropDef
  }
  mainEmpty: Uint8Array
  mainEmptyAllZeroes: boolean
  tree: SchemaPropTree
  separateSortProps: number
  separateSortText: number
  hasSeperateSort: boolean
  seperateSort: SchemaSortUndefinedHandler
  hasSeperateTextSort: boolean
  seperateTextSort: SchemaSortUndefinedHandler & {
    noUndefined: Uint8Array
    localeStringToIndex: Map<string, Uint8Array> // [langCode][index]
    localeToIndex: Map<LangCode, number>
  }
  hasSeperateDefaults: boolean
  seperateDefaults?: { props: Map<number, PropDef>; bufferTmp: Uint8Array }
  createTs?: PropDef[]
  updateTs?: PropDef[]
  locales: Partial<SchemaLocales>
  localeSize: number
  hooks?: SchemaHooks
}

export const VECTOR_BASE_TYPE_SIZE_MAP: Record<VectorBaseType, number> = {
  [VectorBaseType.Int8]: 1,
  [VectorBaseType.Uint8]: 1,
  [VectorBaseType.Int16]: 2,
  [VectorBaseType.Uint16]: 2,
  [VectorBaseType.Int32]: 4,
  [VectorBaseType.Uint32]: 4,
  [VectorBaseType.Float32]: 4,
  [VectorBaseType.Float64]: 8,
}

export const SIZE_MAP: Record<InternalSchemaProp, number> = {
  timestamp: 8, // 64bit
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
  text: 0, // separate
  cardinality: 0, // separate
  references: 0, // separate
  microbuffer: 0, // separate
  alias: 0,
  aliases: 0,
  id: 4,
  binary: 0,
  vector: 0, // separate
  json: 0,
  object: 0,
  colvec: 0, // separate
}

const reverseMap: any = {}
for (const k in TYPE_INDEX_MAP) {
  reverseMap[TYPE_INDEX_MAP[k]] = k
}

// @ts-ignore
export const REVERSE_SIZE_MAP: Record<TypeIndex, number> = {}

for (const k in SIZE_MAP) {
  REVERSE_SIZE_MAP[TYPE_INDEX_MAP[k]] = SIZE_MAP[k]
}

export const REVERSE_TYPE_INDEX_MAP: Record<TypeIndex, InternalSchemaProp> =
  reverseMap

export const ID_FIELD_DEF: PropDef = {
  typeIndex: ID,
  separate: true,
  path: ['id'],
  start: 0,
  prop: 255,
  default: 0,
  len: 4,
  validation: () => true,
  __isPropDef: true,
}

export const EMPTY_MICRO_BUFFER: PropDef = {
  typeIndex: MICRO_BUFFER,
  separate: true,
  path: [''],
  start: 0,
  default: undefined,
  prop: 0,
  len: 1,
  validation: () => true,
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

export type SchemaTypesParsed = { [key: string]: SchemaTypeDef }
export type SchemaTypesParsedById = Record<number, SchemaTypeDef>
