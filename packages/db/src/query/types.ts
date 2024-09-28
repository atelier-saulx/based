import { PropDef, PropDefEdge, SchemaTypeDef } from '../schema/schema.js'

export type Operation =
  | '='
  | 'has'
  | '<'
  | '>'
  | '!='
  | 'like'
  | '>='
  | '<='
  | 'exists'
  | '!exists'

export const operationToByte = (op: Operation) => {
  // useless remove this just constants...
  // also put this in filter
  if (op === '=') {
    return 1
  }
  // 2 is non fixed length check
  if (op === '>') {
    return 3
  }

  if (op === '<') {
    return 4
  }

  if (op === 'has') {
    return 7
  }

  return 0
}

export type MainIncludes = { [start: string]: [number, PropDef] }

// ADD ALL INFO HERE
// FILTER
// SORT
export type QueryIncludeDef = {
  mainIncludes: MainIncludes
  mainLen: number
  includePath: number[]
  includeArr: number[]
  isEdges?: boolean
  schema: SchemaTypeDef
  props: SchemaTypeDef['props'] | PropDef['edges']
  // SEEMS exseive to put eerything here
  edgeSchema?: PropDef['edges']
  fromRef?: PropDef | PropDefEdge
  multiple: boolean
  referencesFilters: {
    // MAKE IT A BIT CLEARER JUST FILTER
    [field: string]: { conditions: Map<number, Buffer[]>; size: number }
  }
  referencesSortOptions: {
    // MAKE IT A BIT CLEARER JUST SORT
    [field: string]: { field: string; order: 'asc' | 'desc' }
  }
  includeFields: Set<string>
  includeTree: IncludeTreeArr // meh
  edgeIncludes?: QueryIncludeDef
  refIncludes?: { [field: string]: QueryIncludeDef } // { } tree for refs prob
}

// call this filter no from ref / reference etc just goes into the QueryDef
export type QueryConditions = {
  conditions: Map<number, Buffer[]>
  references?: Map<number, QueryConditions>
  fromRef?: PropDef
  schema?: SchemaTypeDef
  size?: number
}

export type IncludeTreeArr = (string | PropDef | IncludeTreeArr)[]
