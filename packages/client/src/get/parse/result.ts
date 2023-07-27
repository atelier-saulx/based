import {
  BasedSchemaField,
  BasedSchemaFieldArray,
  BasedSchemaFieldObject,
  BasedSchemaFieldSet,
} from '@based/schema'
import { joinPath } from '../../util'
import { ExecContext, GetCommand } from '../types'

export function parseGetResult(
  ctx: ExecContext,
  cmds: GetCommand[],
  results: any[]
): any {
  let obj = {}
  for (let i = 0; i < results.length; i++) {
    const result = results[i][0]
    const {
      target: { path },
    } = cmds[i]

    const k = joinPath(path)
    const parsed = parseResultRows(ctx, result)
    if (k === '') {
      obj = { ...obj, ...parsed[0] }
    } else {
      obj[k] = parsed
    }
  }

  return obj
}

function parseResultRows(ctx: ExecContext, result: [string, any[]][]) {
  console.log('RAW RESULT', result)
  return result.map((row) => {
    const [id, fields]: [string, any[]] = row

    const typeName = ctx.client.schema.prefixToTypeMapping[id.slice(0, 2)]
    const typeSchema = ctx.client.schema.types[typeName]

    if (!typeSchema) {
      return {}
    }

    return parseObjFields(
      { type: 'object', properties: typeSchema.fields },
      fields
    )
  })
}

function parseObjFields(schema: BasedSchemaField, fields: any[]): any {
  const obj: any = {}
  for (let i = 0; i < fields.length; i += 2) {
    const f = fields[i]
    const v = fields[i + 1]
    let fieldSchema = schema

    let n: any = obj
    const parts = f.split('.')
    for (let i = 0; i < parts.length - 1; i++) {
      const s = parts[i]

      if (!n[s]) {
        n[s] = {}
      }

      n = n[s]
      fieldSchema = (<BasedSchemaFieldObject>fieldSchema)?.properties[s]
    }

    fieldSchema = (<BasedSchemaFieldObject>fieldSchema).properties[
      parts[parts.length - 1]
    ]
    n[parts[parts.length - 1]] = parseFieldResult(fieldSchema, v)
  }

  return obj
}

const FIELD_PARSERS: Record<
  string,
  (x: any, fieldSchema?: BasedSchemaField) => any
> = {
  string: (x) => x,
  number: (x) => Number(x),
  float: (x) => Number(x),
  integer: (x) => Number(x),
  array: (ary: any[], fieldSchema: BasedSchemaFieldArray) => {
    return ary.map((x) => {
      return parseFieldResult(fieldSchema.values, x)
    })
  },
  set: (ary: any[], fieldSchema: BasedSchemaFieldSet) => {
    return ary.map((x) => {
      return parseFieldResult(fieldSchema.items, x)
    })
  },
  object: (ary: any[], fieldSchema: BasedSchemaFieldObject) => {
    return parseObjFields(fieldSchema, ary)
  },
}

function parseFieldResult(fieldSchema: BasedSchemaField, v: any) {
  const parser = FIELD_PARSERS[fieldSchema?.type]
  return parser?.(v, fieldSchema)
}
