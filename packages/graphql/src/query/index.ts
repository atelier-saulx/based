import { GetOptions } from '@based/types'
import { print, FieldNode, FragmentDefinitionNode } from 'graphql'
import { stringOrVariable, typeFromId } from '../util'
import { selectionSetToGet } from '../selection'
import { GQLExecCtx } from '..'

export type GetOp = {
  get?: GetOptions
  fnObserve?: {
    name: string | { $var: string }
    payload: any
  }
}

export function createGet(
  ctx: GQLExecCtx,
  graphqlAst: FieldNode,
  fragments: Record<string, FragmentDefinitionNode>,
  variables: Record<string, any> = {}
): GetOp {
  const opName = graphqlAst?.name?.value
  if (opName === 'observeFn') {
    const idx = graphqlAst.arguments.findIndex((a) => {
      return a.name.value === 'name'
    })

    const name = stringOrVariable(graphqlAst.arguments[idx].value, variables)
    const arg: any = graphqlAst?.arguments?.[1 - idx]?.value

    const serialized =
      !arg || !arg.kind || arg.kind === 'NullValue'
        ? undefined
        : arg.kind === 'ObjectValue'
        ? JSON.parse(
            print(arg).replace(/(['"])?([a-z0-9A-Z_]+)(['"])?:/g, '"$2": ')
          )
        : JSON.parse(print(arg))

    return {
      fnObserve: {
        name,
        payload: serialized,
      },
    }
  }

  // TODO: replace 'root' with 'default type'
  const type = opName === 'node' ? 'root' : opName
  const isValidType =
    type === 'root' || !!ctx.schemas[ctx.db || 'default'].types[type]

  if (!isValidType) {
    // assume it's an observable function call
    const name = opName
    const arg: any = graphqlAst?.arguments?.[0]?.value

    const serialized =
      !arg || !arg.kind || arg.kind === 'NullValue'
        ? undefined
        : arg.kind === 'ObjectValue'
        ? JSON.parse(
            print(arg).replace(/(['"])?([a-z0-9A-Z_]+)(['"])?:/g, '"$2": ')
          )
        : JSON.parse(print(arg))

    return {
      fnObserve: {
        name,
        payload: serialized,
      },
    }
  }

  const id =
    graphqlAst.name.value === 'root'
      ? 'root'
      : stringOrVariable(graphqlAst?.arguments[0]?.value, variables)
  // @ts-ignore
  // const type = typeFromId(client, id)

  const selection = selectionSetToGet(
    ctx,
    type,
    graphqlAst.selectionSet,
    fragments,
    variables
  )

  // @ts-ignore
  selection.$alias = id
  selection.$db = ctx.db || 'default'
  return { get: selection }
}
