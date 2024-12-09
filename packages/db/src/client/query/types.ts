import {
  PropDef,
  PropDefEdge,
  SchemaTypeDef,
} from '../../server/schema/schema.js'

export type MainIncludes = { [start: string]: [number, PropDef] }

export type IncludeTreeArr = (string | PropDef | IncludeTreeArr)[]

enum QueryDefType {
  Edge = 1,
  Reference = 2,
  References = 3,
  Root = 4, // need id
}

export type EdgeTarget = {
  ref: PropDef | PropDefEdge | null
}

export type Target = {
  type: string
  id?: number | void
  ids?: Uint32Array | void
  propDef?: PropDef | PropDefEdge
}

export const isRefDef = (def: QueryDef): def is QueryDefRest => {
  return (
    def.type === QueryDefType.Reference || def.type === QueryDefType.References
  )
}

export type QueryDefFilter = {
  size: number
  conditions: Map<number, Buffer[]>
  references?: Map<number, QueryDefFilter>
  fromRef?: PropDef
  schema?: SchemaTypeDef
  edges?: Map<number, Buffer[]>
  or?: QueryDefFilter
  and?: QueryDefFilter
}

export type QueryDefSearch = {
  size: number
  query: Buffer
  // has to be string or text
  fields: { weight: number; field: number }[]
}

export type QueryDefSort = { prop: PropDefEdge | PropDef; order: 0 | 1 }

export type QueryDefShared = {
  filter: QueryDefFilter
  search: null | QueryDefSearch
  sort: null | QueryDefSort
  reverseProps: any
  range: {
    offset: number
    limit: number
  }
  include: {
    stringFields: Set<string>
    props: Set<number>
    propsRead: { [propName: number]: number }
    main: {
      include: MainIncludes
      len: number
    }
  }
  references: Map<number, QueryDef>
  edges?: QueryDef
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
