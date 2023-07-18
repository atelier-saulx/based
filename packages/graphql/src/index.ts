import {
  OperationDefinitionNode,
  Kind,
  DocumentNode,
  FragmentDefinitionNode,
  parse,
  TypeNode,
} from 'graphql'
import genSchema from './schema'
import { createMutation } from './mutation'
import { createGet } from './query'
import { GetOptions, SetOptions } from '@saulx/selva'

export { genSchema }
export { createGet, createMutation }
export { parse as parseGraphql }

export type BasedOp = {
  get?: GetOptions
  set?: SetOptions
  delete?: {
    $id: string
    db?: string
  }
  fnCall?: {
    name: string | { $var: string }
    payload: any
  }
  fnObserve?: {
    name: string | { $var: string }
    payload: any
  }
}

export type BasedGraphQL = {
  db: string
  opType: 'GET' | 'SET'
  ops: Record<string, BasedOp>
  variables: Record<string, { type: string; required: boolean; list: boolean }>
}

export type GQLExecCtx = {
  schemas: Record<string, any>
  db?: string
}

// export function gql(
//   literals: string | readonly string[],
//   ...args: any[]
// ): () => BasedGraphQL {
//   if (typeof literals === 'string') {
//     literals = [literals]
//   }

//   let result = literals[0]

//   args.forEach((arg, i) => {
//     if (arg && arg.kind === 'Document') {
//       result += arg.loc.source.body
//     } else {
//       result += arg
//     }
//     result += literals[i + 1]
//   })

//   return createOperations(
//     { schemas: this.client.configuration.schema },
//     parse(result)
//   )
// }

export function gql(
  schema: any
): (literals: string | readonly string[], ...args: any[]) => any {
  return (literals, ...args) => {
    if (typeof literals === 'string') {
      literals = [literals]
    }

    let result = literals[0]

    args.forEach((arg, i) => {
      if (arg && arg.kind === 'Document') {
        result += arg.loc.source.body
      } else {
        result += arg
      }
      result += literals[i + 1]
    })

    return gqlToSelvaQuery({ schemas: schema }, parse(result))
  }
}

export function gqlDb(
  db: string = 'default',
  schema: any
): (literals: string | readonly string[], ...args: any[]) => any {
  return (literals, ...args) => {
    if (typeof literals === 'string') {
      literals = [literals]
    }

    let result = literals[0]

    args.forEach((arg, i) => {
      if (arg && arg.kind === 'Document') {
        result += arg.loc.source.body
      } else {
        result += arg
      }
      result += literals[i + 1]
    })

    return gqlToSelvaQuery({ schemas: schema, db }, parse(result))
  }
}

function convertArgType(vType: TypeNode): {
  type: string
  required: boolean
  list: boolean
} {
  if (vType.kind === Kind.LIST_TYPE) {
    const nested = convertArgType(vType.type)
    nested.list = true
    return nested
  } else if (vType?.kind === Kind.NON_NULL_TYPE) {
    const nested = convertArgType(vType.type)
    nested.required = true
    return nested
  }

  // } else if (vType?.kind === Kind.NAMED_TYPE) {
  return {
    type: vType.name.value,
    required: false,
    list: false,
  }
}

export function gqlToSelvaQuery(ctx: GQLExecCtx, document: DocumentNode) {
  let graphqlAst: OperationDefinitionNode
  const fragments: Record<string, FragmentDefinitionNode> = {}
  for (const d of document.definitions) {
    if (d.kind === Kind.OPERATION_DEFINITION) {
      graphqlAst = d
    } else if (d.kind === Kind.FRAGMENT_DEFINITION) {
      fragments[d?.name?.value] = d
    }
  }

  if (!graphqlAst.selectionSet) {
    return
  }

  const fullVars = (graphqlAst?.variableDefinitions || []).reduce((acc, v) => {
    const vName = v?.variable?.name?.value
    const vType = v?.type

    acc[vName] = convertArgType(vType)
    return acc
  }, {})

  let opType: 'GET' | 'SET'
  let opFn

  if (graphqlAst.operation === 'query') {
    opType = 'GET'
    opFn = createGet
  } else {
    opType = 'SET'
    opFn = createMutation
  }

  const responseBody = []
  graphqlAst.selectionSet.selections.map(async (def) => {
    if (def.kind !== Kind.FIELD) {
      // TODO: ?
      return undefined
    }

    const alias = def?.alias?.value
    const name = def.name.value

    const op = opFn(ctx, def, fragments, fullVars)
    responseBody.push(op)
  })

  return responseBody
}

export function createOperations(
  ctx: GQLExecCtx,
  document: DocumentNode
): BasedGraphQL {
  let graphqlAst: OperationDefinitionNode
  const fragments: Record<string, FragmentDefinitionNode> = {}
  for (const d of document.definitions) {
    if (d.kind === Kind.OPERATION_DEFINITION) {
      graphqlAst = d
    } else if (d.kind === Kind.FRAGMENT_DEFINITION) {
      fragments[d?.name?.value] = d
    }
  }

  if (!graphqlAst.selectionSet) {
    return
  }

  const fullVars = (graphqlAst?.variableDefinitions || []).reduce((acc, v) => {
    const vName = v?.variable?.name?.value
    const vType = v?.type

    acc[vName] = convertArgType(vType)
    return acc
  }, {})

  let opType: 'GET' | 'SET'
  let opFn

  if (graphqlAst.operation === 'query') {
    opType = 'GET'
    opFn = createGet
  } else {
    opType = 'SET'
    opFn = createMutation
  }

  const responseBody = {}
  graphqlAst.selectionSet.selections.map(async (def) => {
    if (def.kind !== Kind.FIELD) {
      // TODO: ?
      return undefined
    }

    const alias = def?.alias?.value
    const name = def.name.value

    const op = opFn(ctx, def, fragments, fullVars)
    responseBody[alias || name] = op
  })

  return {
    ops: responseBody,
    opType,
    variables: fullVars,
    db: ctx.db || 'default',
  }
}

export function handleGraphqlVariables(
  op: BasedGraphQL,
  cur: any,
  variables: Record<string, any>
): any {
  if (typeof cur !== 'object') {
    return cur
  }

  if (Array.isArray(cur)) {
    return cur.map((n) => {
      return handleGraphqlVariables(op, n, variables)
    })
  }

  if (cur?.$var) {
    const varName = cur.$var
    const varEntry = op.variables[varName]

    if (varEntry.required && !variables[varName]) {
      throw new Error(`Variable ${varName} required, but not provided`)
    }

    return variables[varName]
  }

  const newObj = {}
  for (const k in cur) {
    newObj[k] = handleGraphqlVariables(op, cur[k], variables)
  }

  return newObj
}
