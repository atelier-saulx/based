import type { SchemaHooks, SchemaProp, SchemaPropHooks } from '../index.js'
import { Validation } from './validation.js'
import {
  PropType,
  PropTypeEnum,
  VectorBaseType,
  VectorBaseTypeEnum,
  LangCodeEnum,
  PropTypeInverse,
  ID_PROP,
  MAIN_PROP,
} from '../../zigTsExports.js'
import type { SchemaLocales } from '../schema/locales.js'

export type PropDef = {
  __isPropDef: true
  schema: SchemaProp<true>
  prop: number // (0-250)
  typeIndex: PropTypeEnum
  separate: boolean
  path: string[]
  start: number
  len: number // bytes or count
  compression?: 0 | 1 // 0 == none , 1 == standard deflate
  enum?: any[]
  dependent?: boolean
  // default here?
  validation: Validation
  default: any
  // references
  inverseTypeName?: string
  inversePropName?: string
  inverseTypeId?: number
  inversePropNumber?: number
  referencesCapped?: number
  // vectors
  vectorBaseType?: VectorBaseTypeEnum
  vectorSize?: number
  // cardinality
  cardinalityMode?: number
  cardinalityPrecision?: number
  // edge stuff
  edgeNodeTypeId?: number
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
  hooks?: SchemaPropHooks
}

export type PropDefEdge = Partial<PropDef> & {
  __isPropDef: true
  typeIndex: PropTypeEnum
  schema: SchemaProp<true>
  len: number
  prop: number // (0-250)
  name: string
  edgesTotalLen?: number
  __isEdge: true
}

export type PropDefAggregate = Partial<PropDef> & {
  __isPropDef: true
  typeIndex: PropTypeEnum
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
  blockCapacity: number
  capped: number // Maximum number of nodes in the type. This creates a circularly collected type.
  insertOnly: boolean // delete not allowed
  partial: boolean // only active block(s) should be loaded in-mem
  mainLen: number
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
  separateSort: SchemaSortUndefinedHandler
  hasSeperateTextSort: boolean
  separateTextSort: SchemaSortUndefinedHandler & {
    noUndefined: Uint8Array
    localeStringToIndex: Map<string, Uint8Array> // [langCode][index]
    localeToIndex: Map<LangCodeEnum, number>
  }
  hasSeperateDefaults: boolean
  createTs?: PropDef[]
  updateTs?: PropDef[]
  locales: Partial<SchemaLocales>
  localeSize: number
  hooks?: SchemaHooks
  propHooks?: {
    [K in keyof SchemaPropHooks]: Set<PropDef>
  }
}

export const VECTOR_BASE_TYPE_SIZE_MAP: Record<VectorBaseTypeEnum, number> = {
  [VectorBaseType.int8]: 1,
  [VectorBaseType.uint8]: 1,
  [VectorBaseType.int16]: 2,
  [VectorBaseType.uint16]: 2,
  [VectorBaseType.int32]: 4,
  [VectorBaseType.uint32]: 4,
  [VectorBaseType.float32]: 4,
  [VectorBaseType.float64]: 8,
}

export const SIZE_MAP: Record<keyof typeof PropType, number> = {
  null: 0,
  timestamp: 8, // 64bit
  // double-precision 64-bit binary format IEEE 754 value
  number: 8, // 64bit
  created: 8,
  updated: 8,
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
  microBuffer: 0, // separate
  alias: 0,
  aliases: 0,
  id: 4,
  binary: 0,
  vector: 0, // separate
  json: 0,
  object: 0,
  colVec: 0,
}

const reverseMap: any = {}
for (const k in PropType) {
  reverseMap[PropType[k]] = k
}

// @ts-ignore
export const REVERSE_SIZE_MAP: Record<TypeIndex, number> = {}

for (const k in SIZE_MAP) {
  REVERSE_SIZE_MAP[PropType[k]] = SIZE_MAP[k]
}

export const ID_FIELD_DEF: PropDef = {
  schema: null as any,
  typeIndex: PropType.id,
  separate: true,
  path: ['id'],
  start: 0,
  prop: ID_PROP,
  default: 0,
  len: 4,
  validation: () => true,
  __isPropDef: true,
}

export const EMPTY_MICRO_BUFFER: PropDef = {
  schema: null as any,
  typeIndex: PropType.microBuffer,
  separate: true,
  path: [''],
  start: MAIN_PROP,
  default: undefined,
  prop: 0,
  len: 1,
  validation: () => true,
  __isPropDef: true,
}

export const getPropTypeName = (propType: PropTypeEnum) => {
  return PropTypeInverse[propType]
}

export const isPropDef = (prop: any): prop is PropDef => {
  if ('__isPropDef' in prop && prop.__isPropDef === true) {
    return true
  }
  return false
}

export type SchemaTypesParsed = { [key: string]: SchemaTypeDef }
export type SchemaTypesParsedById = Record<number, SchemaTypeDef>
