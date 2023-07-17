import { Filter } from '@based/db-query'

export type TraverseByType = {
  $any: TraverseByTypeExpression
  [k: string]: TraverseByTypeExpression
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
    id?: string
    alias?: string
  }
  // fields by type
  fields: {
    [type: string]: {
      [field: string]: any
    }
  }
}

export type GetNode = {
  type: 'node'
} & GetNodeShared

export type GetTraverseShared = {
  filter?: Filter | Filter[]
  nestedCommands?: GetCommand[]
} & GetNodeShared

export type GetTraverseField = {
  type: 'traverse_field'
  sourceField: string[]
} & GetTraverseShared

export type GetTraverseExpr = {
  type: 'traverse_field'
  traverseExpr: TraverseByType
} & GetTraverseShared

export type GetTraverse = GetTraverseField | GetTraverseExpr

export type GetCommand = GetNode | GetTraverse

// TODO: add inherit
