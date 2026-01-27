import {
  type PropDef,
  type PropDefEdge,
  type SchemaTypeDef,
} from '../../schema/index.js'
import { QueryError } from './validation.js'
import { Interval, aggFnOptions } from './aggregates/types.js'
import {
  LangCode,
  LangCodeEnum,
  OrderEnum,
  QueryTypeEnum,
  SortHeader,
  AggFunctionEnum,
} from '../../zigTsExports.js'
import type { ReaderSchema } from '../../protocol/index.js'

type LangName = keyof typeof LangCode

export type IncludeOpts = {
  end?: Partial<Record<LangName, number>> | number
  bytes?: boolean
  meta?: 'only' | true | false // add more opts? make
  codes?: Set<LangCodeEnum>
  fallBacks?: LangCodeEnum[]
  localeFromDef?: LangCodeEnum
  raw?: true
}

export type IncludeField = {
  field: string
  opts?: IncludeOpts
}

export type MainIncludes = Map<number, [number, PropDef, IncludeOpts]>

export type IncludeTreeArr = (string | PropDef | IncludeTreeArr)[]

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

export type QueryDefFilter = {
  partialOffsets?: Set<number> // need this for subs...
  conditions: Map<number, IntermediateByteCode[]>
  references?: Map<number, QueryDefFilter> // make this { edge: QueryDefFilter, ref: QueryDefFilter }
  // in reference we need EDGES as well
  // these cannot have OR read the same as a single condition

  nowOffset?: number // this is for subs
  isEdge?: boolean // something like this
  ref?: PropDef
  select?: ReferenceSelectOperator //this will get there
  or?: QueryDefFilter
  props: { [prop: string]: PropDef | PropDefEdge }
}

// export type QueryDefSearch =
//   | {
//       size: number
//       query: Uint8Array
//       isVector: false
//       fields: {
//         weight: number
//         field: number
//         start: number
//         lang: { lang: LangCodeEnum; fallback: LangCodeEnum[] }
//         typeIndex: number
//       }[]
//     }
//   | {
//       size: number
//       query: Uint8Array
//       prop: number
//       isVector: true // could add typeIndex / len
//       opts: FilterOpts
//     }

export type Aggregation = {
  type: AggFunctionEnum
  propDef: PropDef | PropDefEdge
  resultPos: number
  accumulatorPos: number
  isEdge: boolean
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

export enum ReferenceSelect {
  Index = 1,
  Any = 2,
  All = 3,
}

export type ReferenceSelectValue = {
  type: ReferenceSelect
  index?: number
  prop: PropDef | PropDefEdge
}

export type ReferenceSelectOperator = '*' | '*?' | number

export const getReferenceSelect = (
  p: string,
  def: QueryDef,
): ReferenceSelectValue | void => {
  if (p[p.length - 1] === ']') {
    const [refsField, indexNotation] = p.split('[')
    const index = indexNotation.slice(0, -1)
    const ref = def.schema!.props[refsField]
    if (index === '*') {
      return { type: ReferenceSelect.All, prop: ref }
    }
    if (index === '*?') {
      return { type: ReferenceSelect.Any, prop: ref }
    }
    if (isNaN(Number(index))) {
      return
    }
    return { type: ReferenceSelect.Index, index: Number(index), prop: ref }
  }
}

export type QueryDefShared = {
  selectFirstResult: boolean
  queryType: QueryTypeEnum
  schemaChecksum?: number
  errors: QueryError[]
  lang: { lang: LangCodeEnum; fallback: LangCodeEnum[] }
  filter: QueryDefFilter
  filterContinue?: QueryDefFilter
  aggregate: null | QueryDefAggregation
  // search: null | QueryDefSearch
  sort: null | SortHeader
  order: OrderEnum
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
  schema: null // only add schemaTypeDef
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

export type IntermediateByteCodeLeaf = Uint8Array

export type IntermediateByteCode =
  | IntermediateByteCodeLeaf
  | (IntermediateByteCodeLeaf | IntermediateByteCode)[]
