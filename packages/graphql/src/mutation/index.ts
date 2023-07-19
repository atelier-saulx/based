import { GetOptions, SetOptions } from '../types'
import { ArgumentNode, FieldNode, FragmentDefinitionNode, print } from 'graphql'
import { stringOrVariable, getSelvaTypeName } from '../util'
import inputToSetPayload from './input'
import { selectionSetToGet } from '../selection'
import { GQLExecCtx } from '..'

export type MutOp = {
  get?: GetOptions
  set?: SetOptions
  delete?: SetOptions
  fnCall?: {
    name: string | { $var: string }
    payload: any
  }
}

export function createMutation(
  ctx: GQLExecCtx,
  graphqlAst: FieldNode,
  fragments: Record<string, FragmentDefinitionNode>,
  variables: Record<string, any> = {}
): MutOp {
  let rest: string
  let payloadAst: ArgumentNode
  let id: string
  if (graphqlAst.name.value === 'callFn') {
    const idx = graphqlAst.arguments.findIndex((a) => {
      return a.name.value === 'name'
    })

    const name = stringOrVariable(graphqlAst.arguments[idx].value, variables)
    const arg: any = graphqlAst?.arguments?.[1 - idx]?.value

    const serialized = !arg
      ? true
      : arg.kind === 'ObjectValue'
      ? JSON.parse(
          print(arg).replace(/(['"])?([a-z0-9A-Z_]+)(['"])?:/g, '"$2": ')
        )
      : JSON.parse(print(arg))

    return {
      fnCall: {
        name,
        payload: serialized,
      },
    }
  } else if (graphqlAst.name.value.startsWith('create')) {
    rest = graphqlAst.name.value.slice(6)
    payloadAst = graphqlAst.arguments[0]
  } else if (graphqlAst.name.value.startsWith('set')) {
    rest = graphqlAst.name.value.slice(3)
    const idx = graphqlAst.arguments.findIndex((a) => {
      return a.name.value === 'input'
    })

    payloadAst = graphqlAst.arguments[idx]
    if (rest === 'Root') {
      id = 'root'
    } else {
      // @ts-ignore
      id = stringOrVariable(graphqlAst.arguments[1 - idx].value, variables)
    }
  } else if (graphqlAst.name.value === 'deleteNode') {
    // @ts-ignore
    id = stringOrVariable(graphqlAst.arguments[0].value, variables)
    if (!id) {
      throw new Error(`Can't delete nodes without id argument`)
    }

    return {
      delete: { $id: id, $db: ctx.db || 'default' },
    }
  } else {
    // assume it's a function call
    const name = graphqlAst.name.value
    const arg = graphqlAst.arguments[0]?.value
    const serialized = !arg
      ? true
      : arg.kind === 'ObjectValue'
      ? JSON.parse(
          print(arg).replace(/(['"])?([a-z0-9A-Z_]+)(['"])?:/g, '"$2": ')
        )
      : JSON.parse(print(arg))

    return {
      fnCall: {
        name,
        payload: serialized,
      },
    }

    // throw new Error(`Unsupported mutation operation ${graphqlAst.name.value}`)
  }

  const type = getSelvaTypeName(ctx, rest)

  if (payloadAst.name.value !== 'input') {
    throw new Error(
      `Argument 'input' is required by mutation ${graphqlAst.name.value}`
    )
  }

  const payload = payloadAst.value

  const input = inputToSetPayload(ctx, type, payload, variables)
  const setPayload: SetOptions = Object.assign({}, input, {
    type,
    $db: ctx.db || 'default',
  })
  if (id) {
    setPayload.$id = id
  } else {
    // TODO: should be able to enable this
    // setPayload.$operation = 'insert'
  }

  const selection = selectionSetToGet(
    ctx,
    type,
    graphqlAst.selectionSet,
    fragments,
    variables
  )
  selection.$db = ctx.db || 'default'

  const selectionKeys = Object.keys(selection)
  if (
    selectionKeys.length === 1 &&
    (selectionKeys[0] === 'type' || selectionKeys[0] === 'id')
  ) {
    return { set: setPayload }
  } else if (
    selectionKeys.length === 2 &&
    selectionKeys.every((k) => ['type', 'id'].includes(k))
  ) {
    return { set: setPayload }
  }

  // NOTE: selection does not contain id, you need to plug it in yourself after executing the setPayload
  return {
    set: setPayload,
    get: selection,
  }
}
