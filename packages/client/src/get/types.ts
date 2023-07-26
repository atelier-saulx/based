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

export type GetTraverse = {
  type: 'traverse'

  paging?: { limit: number; offset: number }
  filter?: Filter | Filter[]
  nestedCommands?: GetCommand[]
  recursive?: boolean

  // one of these
  traverseExpr?: TraverseByType // also includes just array of fields ({ $first: [...field] })
  sourceField?: string
  // TODO: edge filter expr
} & GetNodeShared

export type GetCommand = GetNode | GetTraverse

// TODO: add inherit
