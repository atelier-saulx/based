import { ValueNode } from 'graphql'
import { numberOrVariable, stringOrVariable } from '../util'
import { print } from 'graphql'
import { getNestedSchema } from '../util'
import { GQLExecCtx } from '..'

export default function inputToSetPayload(
  ctx: GQLExecCtx,
  type: string,
  graphqlAst: ValueNode,
  variables: Record<string, any> = {},
  path: string = ''
) {
  if (graphqlAst.kind !== 'ObjectValue') {
    return undefined
  }

  const payload = {}
  for (const field of graphqlAst.fields) {
    let name = field.name.value
    const value = field.value

    if (value?.kind === 'NullValue') {
      payload[name] = { $delete: true }
      continue
    }

    const fieldPath = `${path}.${name}`
    const opts = fieldToSetPayload(ctx, type, value, variables, fieldPath)

    if (opts !== undefined) {
      payload[name] = opts
    }
  }

  return payload
}

function fieldToSetPayload(
  ctx: GQLExecCtx,
  type: string,
  graphqlAst: ValueNode,
  variables: Record<string, any> = {},
  path: string = ''
) {
  const fieldSchema = getNestedSchema(ctx, type, path)

  if (!fieldSchema) {
    return undefined
  }

  // if (
  //   graphqlAst.kind === 'Variable' &&
  //   !variables[graphqlAst?.name?.value].value
  // ) {
  //   return { $delete: true }
  // }

  if (graphqlAst.kind === 'Variable') {
    // @ts-ignore
    return { $var: graphqlAst?.name?.value }
  }

  switch (fieldSchema.type) {
    case 'set':
    case 'references':
      const SET_OPS = {
        ADD: '$add',
        REMOVE: '$delete',
        SET: '$value',
      }

      if (graphqlAst.kind !== 'ObjectValue') {
        throw new Error(`Invalid payload ${graphqlAst} for ${path}`)
      }

      let op, ids
      if (graphqlAst.fields[0].name.value === 'op') {
        op = graphqlAst.fields[0].value
        ids = graphqlAst.fields[1].value
      } else {
        op = graphqlAst.fields[1].value
        ids = graphqlAst.fields[0].value
      }

      if (op.kind !== 'EnumValue') {
        throw new Error(
          `Invalid references operation ${op} in ${graphqlAst} for ${path}`
        )
      }

      if (ids.kind !== 'ListValue') {
        throw new Error(
          `Invalid references ids argument ${ids} in ${graphqlAst} for ${path}`
        )
      }

      op = op.value
      if (!SET_OPS[op]) {
        throw new Error(
          `Invalid references operation ${op}, should be one of ${JSON.stringify(
            Object.keys(SET_OPS)
          )} for ${path}`
        )
      }

      ids = ids.values.map((v) => stringOrVariable(v, variables))

      return { [SET_OPS[op]]: ids }
    case 'object':
      if (graphqlAst.kind !== 'ObjectValue') {
        throw new Error(
          `Trying to set a non-object value ${graphqlAst} to object field ${path}`
        )
      }

      return inputToSetPayload(ctx, type, graphqlAst, variables, path)
    case 'url':
    case 'phone':
    case 'digest':
    case 'string':
    case 'reference':
      return stringOrVariable(graphqlAst, variables)
    case 'float':
    case 'int':
    case 'number':
      return numberOrVariable(graphqlAst, variables)
    case 'json':
      if (graphqlAst.kind === 'ObjectValue') {
        return JSON.parse(
          print(graphqlAst).replace(/(['"])?([a-z0-9A-Z_]+)(['"])?:/g, '"$2": ')
        )
      }

      return (graphqlAst as any)?.value
    default:
      console.log('CATCHALL', fieldSchema, graphqlAst)
      return undefined
  }
}
