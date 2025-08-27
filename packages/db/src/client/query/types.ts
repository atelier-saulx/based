import { LangCode, LangName } from '@based/schema'
import { PropDef, PropDefEdge, SchemaTypeDef } from '@based/schema/def'
import { FilterOpts } from './filter/types.js'
import { QueryError } from './validation.js'
import { AggregateType, Interval, aggFnOptions } from './aggregates/types.js'
import { ReaderSchema } from './query.js'

export type IncludeOpts = {
  end?: number
  bytes?: boolean
  meta?: 'only' | true | false // add more opts?
  codes?: Set<LangCode>
  fallBacks?: LangCode[]
  localeFromDef?: LangCode
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
  id?: number | void
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

export type FilterCondition = Uint8Array

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
  id: QueryByAliasObj | number | Uint32Array | (QueryByAliasObj | number)[],
): id is QueryByAliasObj => {
  if (id instanceof Uint32Array) {
    return false
  }
  return (
    typeof id === 'object' &&
    id !== null &&
    !Array.isArray(id) &&
    !ArrayBuffer.isView(id)
  )
}

export const READ_ID = 255
export const READ_EDGE = 252
export const READ_REFERENCES = 253
export const READ_REFERENCE = 254
export const READ_AGGREGATION = 250
export const READ_META = 249 // hmm expand this better

export const enum includeOp {
  DEFAULT = 1,
  REFERENCES_AGGREGATION = 2,
  EDGE = 3,
  REFERENCES = 4,
  REFERENCE = 5,
  META = 6, // this can be a small buffer as well
  PARTIAL = 7,
}
