import { Filter } from '@based/db-query'
import { BasedDbClient } from '..'

export type ExecContext = {
  client: BasedDbClient
  lang?: string
}

export type TraverseByType = {
  $any: TraverseByTypeExpression
  [k: string]: TraverseByTypeExpression
}

export type Path = (string | number)[]

export type Field = {
  type: 'field'
  field: Path
  aliased?: Path[]
  exclude?: true
}

// * = all
// <identifier>@<field(s)> = $field (alias field)
// <field1>|<field2>|<field3> = $field with array option
export type Fields = {
  $any?: Field[]
  byType?: {
    [type: string]: Field[]
  }
}

export type TraverseByTypeExpression =
  | false
  | string
  | {
      $first?: TraverseByTypeExpression[]
      $all?: TraverseByTypeExpression[]
    }

export type GetNodeShared = {
  target: { path: (string | number)[] }
  source: {
    idList?: string[]
    id?: string
    alias?: string
  }
  // fields by type
  fields: Fields

  nestedCommands?: GetCommand[]
}

export type GetNode = {
  type: 'node'
  noMerge?: true
} & GetNodeShared

export type GetTraverse = {
  type: 'traverse'

  paging?: { limit: number; offset: number }
  sort?: { field: string; order: 'asc' | 'desc' }
  filter?: Filter | Filter[]
  recursive?: boolean
  isSingle?: boolean

  // one of these
  traverseExpr?: TraverseByType // also includes just array of fields ({ $first: [...field] })
  sourceField?: string
  // TODO: edge filter expr
} & GetNodeShared

export type GetCommand = GetNode | GetTraverse

// TODO: add inherit
