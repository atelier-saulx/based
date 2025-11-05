import { LangCode, LangName } from '@based/schema'
import { PropDef, PropDefEdge, SchemaTypeDef } from '@based/schema/def'
import { FilterOpts, Operator } from './filter/types.js'
import { QueryError } from './validation.js'
import { Interval, aggFnOptions } from './aggregates/types.js'
import { AggregateType, ReaderSchema } from '@based/protocol/db-read'

export type IncludeOpts = {
  end?: { [langCode: string]: number } | number
  bytes?: boolean
  meta?: 'only' | true | false // add more opts?
  codes?: Set<LangCode>
  fallBacks?: LangCode[]
  localeFromDef?: LangCode
  raw?: true
}

export type IncludeField = {
  field: string
  opts?: IncludeOpts
}

export type MainIncludes = { [start: string]: [number, PropDef, IncludeOpts] }

export type IncludeTreeArr = (string | PropDef | IncludeTreeArr)[]

export enum QueryType {
  id = 0,
  ids = 1,
  default = 2,
  alias = 3,
  aggregates = 4,
  aggregatesCountType = 5,
}

enum QueryDefType {
  Edge = 1,
  Reference = 2,
  References = 3,
  Root = 4,
}

export type EdgeTarget = {
  ref: PropDef | PropDefEdge | null
}

export type Target = {
  type: string
  id?: number | void | Promise<number>
  ids?: Uint32Array | void
  propDef?: PropDef | PropDefEdge
  alias?: QueryByAliasObj
  // This can just instantly be added
  resolvedAlias?: { def: PropDef; value: string }
}

export const isRefDef = (def: QueryDef): def is QueryDefRest => {
  return (
    def.type === QueryDefType.Reference || def.type === QueryDefType.References
  )
}

export type FilterCondition = {
  buffer: Uint8Array
  subscriptionMeta?: {
    now?: { prop: number; operator: Operator; value: string[] }
  }
}

export type QueryDefFilter = {
  size: number
  conditions: Map<number, FilterCondition[]>
  exists?: { prop: PropDef | PropDefEdge; negate: boolean }[]
  references?: Map<number, QueryDefFilter>
  fromRef?: PropDef
  schema?: SchemaTypeDef
  edges?: Map<number, FilterCondition[]>
  or?: QueryDefFilter
  // Make this work
  and?: QueryDefFilter
}

export type QueryDefSearch =
  | {
      size: number
      query: Uint8Array
      isVector: false
      fields: {
        weight: number
        field: number
        start: number
        lang: { lang: LangCode; fallback: LangCode[] }
        typeIndex: number
      }[]
    }
  | {
      size: number
      query: Uint8Array
      prop: number
      isVector: true // could add typeIndex / len
      opts: FilterOpts
    }

export type QueryDefSort = {
  prop: PropDefEdge | PropDef
  order: 0 | 1
  lang: LangCode
}

export type Aggregation = {
  type: AggregateType
  propDef: PropDef // PropDefEdge |
  resultPos: number
  accumulatorPos: number
  // add result field
}

export type QueryDefAggregation = {
  size: number
  groupBy?: aggPropDef
  // only field 0 to start
  aggregates: Map<number, Aggregation[]>
  option?: aggFnOptions
  totalResultsSize: number
  totalAccumulatorSize: number
}

export interface aggPropDef extends PropDef {
  stepType?: Interval
  stepRange?: number
  tz?: number
  display?: Intl.DateTimeFormat
}

export type LangFallback = LangName | false

export type QueryDefShared = {
  // getFirst: boolean
  queryType: QueryType
  schemaChecksum?: number
  errors: QueryError[]
  lang: { lang: LangCode; fallback: LangCode[] }
  filter: QueryDefFilter
  aggregate: null | QueryDefAggregation
  search: null | QueryDefSearch
  sort: null | QueryDefSort
  skipValidation: boolean
  range: {
    offset: number
    limit: number
  }
  include: {
    stringFields: Map<string, IncludeField>
    props: Map<number, { def: PropDef | PropDefEdge; opts?: IncludeOpts }>
    main: {
      include: MainIncludes
      len: number
    }
  }
  references: Map<number, QueryDef>
  edges?: QueryDefEdges
  readSchema?: ReaderSchema
}

export type QueryDefEdges = {
  type: QueryDefType.Edge
  target: EdgeTarget
  schema: null
  props: PropDef['edges']
} & QueryDefShared

export type QueryDefRest = {
  type: QueryDefType.References | QueryDefType.Reference | QueryDefType.Root
  target: Target
  schema: SchemaTypeDef | null
  props: SchemaTypeDef['props'] | PropDef['edges']
} & QueryDefShared

export type QueryDef = QueryDefEdges | QueryDefRest

export type QueryTarget = EdgeTarget | Target

export { QueryDefType }

export type QueryByAliasObj = {
  [key: string]: string | QueryByAliasObj
}

export const isAlias = (
  id:
    | Promise<number>
    | QueryByAliasObj
    | number
    | Uint32Array
    | (QueryByAliasObj | number | Promise<number>)[],
): id is QueryByAliasObj => {
  if (id instanceof Uint32Array) {
    return false
  }
  return (
    typeof id === 'object' &&
    id !== null &&
    !Array.isArray(id) &&
    !ArrayBuffer.isView(id) &&
    typeof id.then !== 'function'
  )
}

export const enum includeOp {
  DEFAULT = 1,
  REFERENCES_AGGREGATION = 2,
  EDGE = 3,
  REFERENCES = 4,
  REFERENCE = 5,
  META = 6, // this can be a small buffer as well
  PARTIAL = 7,
}
