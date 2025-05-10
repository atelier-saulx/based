import type { LangCode, SchemaLocales } from '../index.js'
import { Validation } from './validation.js'

// WARN: The following type codes are used in js and zig but selva has its own typing.
export const NULL = 0
export const TIMESTAMP = 1
export const NUMBER = 4
export const CARDINALITY = 5
export const INT8 = 20
export const UINT8 = 6
export const INT16 = 21
export const UINT16 = 22
export const INT32 = 23
export const UINT32 = 7
export const BOOLEAN = 9
export const ENUM = 10
export const STRING = 11
export const TEXT = 12
export const REFERENCE = 13
export const REFERENCES = 14
export const WEAK_REFERENCE = 15
export const WEAK_REFERENCES = 16
export const MICRO_BUFFER = 17
export const ALIAS = 18
export const ALIASES = 19
export const BINARY = 25
export const ID = 26
export const VECTOR = 27
export const JSON = 28
export const OBJECT = 29

export const TYPE_INDEX_MAP = {
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

const numberTypeValues = [
  NUMBER,
  UINT16,
  UINT32,
  INT16,
  INT32,
  UINT8,
  INT8,
  CARDINALITY,
] as const

export function isNumberType(type: TypeIndex): boolean {
  return (numberTypeValues as readonly number[]).includes(type)
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
  len: number // bytes
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
  // edge stuff
  edgeMainLen?: 0
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

export type SchemaTypeDef = {
  cnt: number
  checksum: number
  type: string
  lastId: number
  blockCapacity: number
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
  seperateSort: SchemaSortUndefinedHandler
  hasSeperateTextSort: boolean
  seperateTextSort: SchemaSortUndefinedHandler & {
    noUndefined: Uint8Array
    localeStringToIndex: Map<string, Uint8Array> // [langCode][index]
    localeToIndex: Map<LangCode, number>
  }
  createTs?: PropDef[]
  updateTs?: PropDef[]
  locales: Partial<SchemaLocales>
  localeSize: number
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
}

const reverseMap: any = {}
for (const k in TYPE_INDEX_MAP) {
  reverseMap[TYPE_INDEX_MAP[k]] = k
}

export const REVERSE_SIZE_MAP: Record<TypeIndex, number> = {}

for (const k in SIZE_MAP) {
  REVERSE_SIZE_MAP[TYPE_INDEX_MAP[k]] = SIZE_MAP[k]
}

export const REVERSE_TYPE_INDEX_MAP: Record<TypeIndex, InternalSchemaProp> =
  reverseMap

export const ID_FIELD_DEF: PropDef = {
  typeIndex: TYPE_INDEX_MAP['id'],
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
  typeIndex: TYPE_INDEX_MAP['microbuffer'],
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
