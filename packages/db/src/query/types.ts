import { PropDef, PropDefEdge, SchemaTypeDef } from '../schema/schema.js'

export type MainIncludes = { [start: string]: [number, PropDef] }

export type IncludeTreeArr = (string | PropDef | IncludeTreeArr)[]

// ADD ALL INFO HERE
// FILTER
// SORT

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
}

export type QueryDefSort = { prop: PropDefEdge | PropDef; order: 0 | 1 }

export type QueryDefShared = {
  filter: QueryDefFilter

  sort: null | QueryDefSort

  range: {
    offset: number
    limit: number
  }

  include: {
    // nested fields
    // if branch you immediatly make a queryDef
    stringFields: Set<string>
    props: Set<number>
    main: {
      include: MainIncludes
      len: number
    }
  }

  references: Map<number, QueryDef>

  edges?: QueryDef

  // edges: Map<number, QueryDef>

  // for reading do later
  // tree: IncludeTreeArr
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
