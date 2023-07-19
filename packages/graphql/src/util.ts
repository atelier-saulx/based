import { ListValueNode, ValueNode } from 'graphql'
import { GQLExecCtx } from '.'

export function getTypeFromId(schema: any, id: string): string | undefined {
  if (id.startsWith('ro')) {
    return 'root'
  }

  return schema.prefixToTypeMapping[id.substr(0, 2)]
}

function getNestedSchema(schema: any, id: string, field: string): any | null {
  if (!field || field === '' || typeof field !== 'string') {
    return null
  }

  const type = getTypeFromId(schema, id)
  const fields = field.split('.')

  const typeSchema = type === 'root' ? schema.rootType : schema.types[type]
  if (!typeSchema || !typeSchema.fields) {
    return null
  }

  let firstSegment = fields[0]
  if (firstSegment.endsWith(']')) {
    // sanitize array types to look up the array so it ends up in the array object schema if below
    for (let j = firstSegment.length - 1; j >= 0; j--) {
      if (firstSegment[j] === '[') {
        firstSegment = firstSegment.slice(0, j)
        break
      }
    }
  }

  let prop: any = typeSchema.fields[firstSegment]
  if (!prop) {
    return null
  }

  for (let i = 1; i < fields.length; i++) {
    let segment = fields[i]

    if (segment.endsWith(']')) {
      // sanitize array types to look up the array so it ends up in the array object schema if below
      for (let j = segment.length - 1; j >= 0; j--) {
        if (segment[j] === '[') {
          segment = segment.slice(0, j)
          break
        }
      }
    }

    if (!prop) {
      return null
    }

    if (prop.type === 'text' && i === fields.length - 1) {
      return { type: 'string' }
    }

    if (prop.values) {
      // record types skip the next key
      prop = prop.values
    } else if (prop.type === 'array') {
      prop = prop.items
      prop = prop.properties[segment]
    } else {
      if (!prop.properties) {
        return null
      }

      prop = prop.properties[segment]
    }
  }

  return prop
}

export function getSchema(ctx: GQLExecCtx): any {
  return ctx.schemas[ctx.db || 'default']
}

export function valueOrVariable(
  v: ValueNode,
  variables: Record<string, any> = {}
): { $var: string } | any {
  if (!v) {
    return undefined
  }

  if (v.kind === 'StringValue') {
    return v.value
  } else if (v.kind === 'EnumValue') {
    return v.value
  } else if (v.kind === 'FloatValue') {
    return Number(v.value)
  } else if (v.kind === 'IntValue') {
    return Number(v.value)
  } else if (v.kind === 'ListValue') {
    return v.values.map((n) => {
      return valueOrVariable(n, variables)
    })
  } else if (v.kind === 'Variable') {
    const vName = v.name.value

    // @ts-ignore
    return { $var: vName }
  } else {
    throw new Error(
      `String or variable name requried for references, ${JSON.stringify(
        v,
        null,
        2
      )} given`
    )
  }
}

export function stringOrVariable(
  v: ValueNode,
  variables: Record<string, any> = {}
): { $var: string } | string {
  if (!v) {
    return undefined
  }

  if (v.kind === 'StringValue') {
    return v.value
  } else if (v.kind === 'Variable') {
    const vName = v.name.value

    // @ts-ignore
    return { $var: vName }
  } else {
    throw new Error(
      `String or variable name requried for references, ${JSON.stringify(
        v,
        null,
        2
      )} given`
    )
  }
}

export function numberOrVariable(
  v: ValueNode,
  variables: Record<string, any> = {}
): { $var: string } | number {
  if (v.kind === 'IntValue') {
    return Number(v.value)
  } else if (v.kind === 'FloatValue') {
    return Number(v.value)
  } else if (v.kind === 'Variable') {
    const vName = v.name.value

    // @ts-ignore
    return { $var: vName }
  } else {
    throw new Error(
      `String or variable name requried for references, ${JSON.stringify(
        v,
        null,
        2
      )} given`
    )
  }
}

export function getSelvaTypeName(ctx: GQLExecCtx, typeName: string): string {
  const selvaTypeName = getSchema(ctx).types[typeName]
    ? typeName
    : typeName[0].toLowerCase() + typeName.slice(1)

  return selvaTypeName
}

export function typeFromId(ctx: GQLExecCtx, id: string) {
  return id === 'root'
    ? 'root'
    : getSchema(ctx).prefixToTypeMapping[id.slice(0, 2)]
}

function getNestedSchemaWrapper(ctx: GQLExecCtx, type: string, path: string) {
  const schema = getSchema(ctx)

  const prefix = type === 'root' ? 'ro' : schema?.types[type]?.prefix
  if (!prefix) {
    return undefined
  }

  return getNestedSchema(schema, prefix, path.slice(1))
}
export { getNestedSchemaWrapper as getNestedSchema }
