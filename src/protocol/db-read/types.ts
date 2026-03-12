import type { SchemaHooks } from '../../schema/index.js'
import type {
  LangCodeEnum,
  PropTypeEnum,
  VectorBaseTypeEnum,
} from '../../zigTsExports.js'

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

export enum ReadSchemaEnum {
  edge = 1,
  default = 2,
  single = 3,
}

export enum ReadMeta {
  only = 1,
  combined = 2,
}

export type ReadInstruction = (
  q: ReadSchema,
  result: Uint8Array,
  i: number,
  item: Item,
) => number

export type ReadLocales = { [langCode: string]: string }

export type ReadProp = {
  path: string[]
  type: PropTypeEnum
  meta?: ReadMeta
  enum?: any[]
  vectorBaseType?: VectorBaseTypeEnum
  len?: number
  readBy: number
  // need to encode meta
  locales?: {
    [code: string]: { name: string; meta?: ReadMeta; readBy: number }
  }
}

export type ReadAggregateSchema = {
  aggregates: ReadAggregates[]
  groupBy?: ReadGroupBy[]
  totalResultsSize: number
}
export type ReadAggregates = {
  path: string[]
  type: number
  resultPos: number
}

export type ReadGroupBy = {
  typeIndex: PropTypeEnum
  stepRange?: number
  stepType?: boolean
  display?: Intl.DateTimeFormat
  enum?: any[]
}

export type ReadSchema = {
  readId: number
  props: { [prop: string]: ReadProp }
  main: { props: { [start: string]: ReadProp }; len: number }
  type: ReadSchemaEnum
  refs: {
    [prop: string]: {
      schema: ReadSchema
      prop: ReadProp
    }
  }
  hook?: SchemaHooks['read']
  aggregate?: ReadAggregateSchema
  edges?: ReadSchema
  search: boolean
}

export const COMPRESSED = 1
export const NOT_COMPRESSED = 0

export const PROPERTY_BIT_MAP = {
  meta: 1 << 0,
  enum: 1 << 1,
  vectorBaseType: 1 << 2,
  len: 1 << 3,
  locales: 1 << 4,
  localesWithMeta: 1 << 5,
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
