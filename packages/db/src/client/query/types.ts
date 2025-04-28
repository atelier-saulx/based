import { LangCode } from '@based/schema'
import { PropDef, PropDefEdge, SchemaTypeDef } from '@based/schema/def'
import { FilterOpts } from './filter/types.js'
import { QueryError } from './validation.js'

export type MainIncludes = { [start: string]: [number, PropDef] }

export type IncludeTreeArr = (string | PropDef | IncludeTreeArr)[]

export enum QueryType {
  id = 0,
  ids = 1,
  default = 2,
  alias = 3,
  aggregates = 4,
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
        lang: LangCode
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

export type QueryDefShared = {
  errors: QueryError[]
  lang: LangCode
  filter: QueryDefFilter
  search: null | QueryDefSearch
  sort: null | QueryDefSort
  skipValidation: boolean
  range: {
    offset: number
    limit: number
  }
  include: {
    langTextFields: Map<
      number,
      { def: PropDef | PropDefEdge; codes: Set<LangCode> }
    >
    stringFields: Set<string>
    props: Map<number, PropDef | PropDefEdge>
    propsRead: { [propName: number]: number }
    main: {
      include: MainIncludes
      len: number
    }
  }
  references: Map<number, QueryDef>
  edges?: QueryDef
  aggregation: AggFlag
}

export type QueryDefEdges = {
  type: QueryDefType.Edge
  target: EdgeTarget
  schema: null
  props: PropDef['edges']
  reverseProps: PropDef['edges']
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

export const enum AggFlag {
  NONE = 0,
  AVG = 1,
  CARDINALITY = 2,
  CONCAT = 3, // string aggregation, delimiter should be an argument
  COUNT = 4,
  MAX = 5,
  MIN = 6,
  MODE = 7, // ordered-set
  PERCENTILE = 8, // continuous or discrete should be optional parameters, default = discrete
  RANK = 9, // hypothetical-set, dense should be optional parameter
  STDDEV = 10, // population or sample should be optional parameters, default = sample
  SUM = 11,
  VARIANCE = 12,
  TEMP = 255,
}
