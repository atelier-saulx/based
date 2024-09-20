import { FieldDef, SchemaTypeDef } from '../index.js'

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

export type MainIncludes = { [start: string]: [number, FieldDef] }

export type QueryIncludeDef = {
  mainIncludes: MainIncludes
  mainLen: number
  includePath: number[]
  includeArr: number[]
  schema: SchemaTypeDef
  fromRef?: FieldDef
  multiple: boolean
  referencesFilters: {
    [field: string]: { conditions: Map<number, Buffer[]>; size: number }
  }
  includeFields: Set<string>
  includeTree: IncludeTreeArr // meh
  refIncludes?: { [field: string]: QueryIncludeDef } // { } tree for refs prob
}

export type QueryConditions = {
  conditions: Map<number, Buffer[]>
  references?: Map<number, QueryConditions>
  fromRef?: FieldDef
  schema?: SchemaTypeDef
}

export type IncludeTreeArr = (string | FieldDef | IncludeTreeArr)[]
