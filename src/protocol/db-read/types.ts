import type { SchemaHooks } from '../../schema/index.js'
import type { PropTypeEnum, VectorBaseTypeEnum } from '../../zigTsExports.js'

export type Item = {
  id: number
} & { [key: string]: any }

export type Meta = {
  checksum: number
  size: number
  crc32: number
  compressed: boolean
  value?: any
  compressedSize: number
  lang?: string
}

export type AggItem = Partial<Item>

export type TypedArray =
  | Int8Array
  | Uint8Array
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array

export enum ReaderSchemaEnum {
  edge = 1,
  default = 2,
  single = 3,
}

export enum ReaderMeta {
  only = 1,
  combined = 2,
  onlyFallback = 3,
  combinedFallback = 4,
}

export type ReadInstruction = (
  q: ReaderSchema,
  result: Uint8Array,
  i: number,
  item: Item,
) => number

export type ReaderLocales = { [langCode: string]: string }

export type ReaderPropDef = {
  path: string[]
  typeIndex: PropTypeEnum
  meta?: ReaderMeta
  enum?: any[]
  vectorBaseType?: VectorBaseTypeEnum
  len?: number
  readBy: number
  locales?: { [langCode: string]: string }
  cardinalityMode?: number
  cardinalityPrecision?: number
}

export type ReaderAggregateSchema = {
  aggregates: {
    path: string[]
    type: number
    resultPos: number
  }[]
  groupBy?: {
    typeIndex: PropTypeEnum
    stepRange?: number
    stepType?: boolean
    display?: Intl.DateTimeFormat // find a way for this -- shitty
    enum?: any[]
  }
  totalResultsSize: number
}

// Move these types to seperate pkg including query def agg
export type ReaderSchema = {
  readId: number
  // maybe current read id that you add
  props: { [prop: string]: ReaderPropDef }
  main: { props: { [start: string]: ReaderPropDef }; len: number }
  type: ReaderSchemaEnum
  refs: {
    [prop: string]: {
      schema: ReaderSchema
      prop: ReaderPropDef
    }
  }
  hook?: SchemaHooks['read']
  aggregate?: ReaderAggregateSchema
  edges?: ReaderSchema
  search: boolean
}

export const READ_ID = 255
export const READ_EDGE = 252
export const READ_REFERENCES = 253
export const READ_REFERENCE = 254
export const READ_AGGREGATION = 250
export const READ_META = 249 // hmm expand this better

export const COMPRESSED = 1
export const NOT_COMPRESSED = 0

export const PROPERTY_BIT_MAP = {
  meta: 1 << 0,
  enum: 1 << 1,
  vectorBaseType: 1 << 2,
  len: 1 << 3,
  locales: 1 << 4,
}

export const DEF_BIT_MAP = {
  search: 1 << 0,
  refs: 1 << 1,
  props: 1 << 2,
  main: 1 << 3,
  edges: 1 << 4,
  hook: 1 << 5,
  aggregate: 1 << 6,
}

export const GROUP_BY_BIT_MAP = {
  stepRange: 1 << 0,
  stepType: 1 << 1,
  display: 1 << 2,
  enum: 1 << 3,
}
