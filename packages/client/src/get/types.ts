import { Filter } from '@based/db-query'
import { BasedSchemaField } from '@based/schema'
import { BasedDbClient } from '..'

export type ExecContext = {
  client: BasedDbClient
  lang?: string
  fieldAliases?: Record<string, { fieldSchema: BasedSchemaField; value: any }>
  commandPath?: Path
}

export type TraverseByType = {
  $any: TraverseByTypeExpression
  [k: string]: TraverseByTypeExpression
}

export type Path = (string | number)[]

export type Field = {
  type: 'field'
  field: Path
  aliased?: string[]
  exclude?: boolean
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

export type GetTraversalShared = {
  paging?: { limit: number; offset: number }
  sort?: { field: string; order: 'asc' | 'desc' }
  filter?: Filter | Filter[]
  recursive?: boolean

  // one of these
  traverseExpr?: TraverseByType // also includes just array of fields ({ $first: [...field] })
  sourceField?: string

  nestedFind?: GetTraverse | GetTraverseIds

  // TODO: edge filter expr
} & GetNodeShared

export type GetTraverse = {
  type: 'traverse'

  isSingle?: boolean
} & GetTraversalShared

export type GetTraverseIds = {
  type: 'ids'

  isSingle?: boolean
} & GetTraversalShared

export type GetAggregate = {
  type: 'aggregate'

  function: any
} & GetTraversalShared

export type GetCommand = GetNode | GetTraverse | GetAggregate | GetTraverseIds

// TODO: add inherit
