import { Filter } from '@based/db-query'
import { BasedDbClient } from '..'

export type ExecContext = {
  client: BasedDbClient
  lang?: string
  cb: (args: { target: { path: string }; value: any }) => void
}

export type TraverseByType = {
  $any: TraverseByTypeExpression
  [k: string]: TraverseByTypeExpression
}

export type Fields = {
  $any?: (string | string[])[]
  [type: string]: (string | string[])[]
}

export type TraverseByTypeExpression =
  | false
  | string
  | {
      $first?: TraverseByTypeExpression[]
      $all?: TraverseByTypeExpression[]
    }

export type GetNodeShared = {
  target: { path: string }
  source: {
    idList?: string[]
    id?: string
    alias?: string
  }
  fields: Fields
  // fields by type
}

export type GetNode = {
  type: 'node'
} & GetNodeShared

export type GetTraverseShared = {
  paging: { limit: number; offset: number }
  filter?: Filter | Filter[]
  nestedCommands?: GetCommand[]
  recursive?: boolean
  // TODO: edge filter expr
} & GetNodeShared

export type GetTraverseField = {
  type: 'traverse_field'
  sourceField: string
} & GetTraverseShared

export type GetTraverseExpr = {
  type: 'traverse_expr'
  traverseExpr: TraverseByType // also includes just array of fields ({ $first: [...field] })
} & GetTraverseShared

export type GetTraverse = GetTraverseField | GetTraverseExpr

export type GetCommand = GetNode | GetTraverse

// TODO: add inherit
