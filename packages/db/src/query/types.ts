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
  fields: FieldDef[]
  schema: SchemaTypeDef
  fromRef?: FieldDef
  includeFields: Set<string>
  includeTree: IncludeTreeArr // meh
  refIncludes?: { [start: string]: QueryIncludeDef } // { } tree for refs prob
}

export type IncludeTreeArr = (string | FieldDef | IncludeTreeArr)[]
