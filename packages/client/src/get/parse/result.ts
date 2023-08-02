import {
  BasedSchemaField,
  BasedSchemaFieldArray,
  BasedSchemaFieldObject,
  BasedSchemaFieldSet,
} from '@based/schema'
import { deepMerge, getByPath, setByPath } from '@saulx/utils'
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
    const cmd: GetCommand = cmds[i]
    console.dir({ result, cmd: cmds[i] }, { depth: 8 })
    const {
      target: { path },
      source,
    } = cmd

    const k = joinPath(path)
    const parsed = parseResultRows(ctx, result)

    if (k === '') {
      obj = { ...obj, ...parsed[0] }
    } else {
      if (cmd.type === 'node') {
        const v = parsed[0]
        const cur = getByPath(obj, path)
        const o = deepMerge({}, cur, v)
        setByPath(obj, path, o)
      } else if (cmd.isSingle) {
        setByPath(obj, path, parsed[0])
      } else {
        setByPath(obj, path, parsed)
      }
    }
  }

  return obj
}

function parseResultRows(ctx: ExecContext, result: [string, any[]][]): any {
  return result.map((row) => {
    if (!row) {
      return {}
    }

    const [id, fields]: [string, any[]] = row

    const typeName = ctx.client.schema.prefixToTypeMapping[id.slice(0, 2)]
    const typeSchema =
      typeName === 'root'
        ? ctx.client.schema.root
        : ctx.client.schema.types[typeName]

    if (!typeSchema) {
      return {}
    }

    return parseObjFields(
      ctx,
      { type: 'object', properties: typeSchema.fields },
      fields
    )
  })
}

function parseObjFields(
  ctx: ExecContext,
  schema: BasedSchemaField,
  fields: any[]
): any {
  const obj: any = {}
  for (let i = 0; i < fields.length; i += 2) {
    const f = fields[i]
    const v = fields[i + 1]
    let fieldSchema = schema

    const [alias, rest] = f.split('@')

    let n: any = obj
    const parts = (rest ?? alias).split('.')
    for (let i = 0; i < parts.length - 1; i++) {
      const s = parts[i]

      if (!n[s]) {
        n[s] = {}
      }

      n = n[s]
      fieldSchema = (<BasedSchemaFieldObject>fieldSchema)?.properties[s]
    }

    if ((<BasedSchemaFieldObject>fieldSchema).properties) {
      fieldSchema = (<BasedSchemaFieldObject>fieldSchema).properties[
        parts[parts.length - 1]
      ]
    } else if (fieldSchema.type === 'text') {
      fieldSchema = { type: 'string' }
    }

    const res = parseFieldResult(ctx, fieldSchema, v)
    if (res === undefined) {
      continue
    }

    if (alias) {
      setByPath(obj, alias.split('.'), res)
    } else {
      n[parts[parts.length - 1]] = res
    }
  }

  return obj
}

function parseRecFields(
  ctx: ExecContext,
  fieldSchema: BasedSchemaField,
  fields: any[]
): any {
  const obj: any = {}
  for (let i = 0; i < fields.length; i += 2) {
    const f = fields[i]
    const v = fields[i + 1]

    obj[f] = parseFieldResult(ctx, fieldSchema, v)
  }

  return obj
}

const FIELD_PARSERS: Record<
  string,
  (x: any, ctx?: ExecContext, fieldSchema?: BasedSchemaField) => any
> = {
  string: (x) => x,
  reference: (x) => x,
  boolean: (x) => !!x,
  number: (x) => Number(x),
  timestamp: (x) => Number(x),
  cardinality: (x) => Number(x),
  float: (x) => Number(x),
  integer: (x) => Number(x),
  text: (x, ctx: ExecContext) => {
    if (ctx.lang) {
      return x
    }

    return parseRecFields(ctx, { type: 'string' }, x)
  },
  array: (ary: any[], ctx: ExecContext, fieldSchema: BasedSchemaFieldArray) => {
    const res = ary.map((x) => {
      return parseFieldResult(ctx, fieldSchema.values, x)
    })

    if (!res.length) {
      return
    }

    return res
  },
  set: (ary: any[], ctx: ExecContext, fieldSchema: BasedSchemaFieldSet) => {
    const res = ary.map((x) => {
      return parseFieldResult(ctx, fieldSchema.items, x)
    })

    if (!res.length) {
      return
    }

    return res
  },
  references: (ary: any[], ctx: ExecContext) => {
    const res = ary.map((x) => {
      return parseFieldResult(ctx, { type: 'string' }, x)
    })

    if (!res.length) {
      return
    }

    return res
  },
  object: (
    ary: any[],
    ctx: ExecContext,
    fieldSchema: BasedSchemaFieldObject
  ) => {
    return parseObjFields(ctx, fieldSchema, ary)
  },
  record: (
    ary: any[],
    ctx: ExecContext,
    fieldSchema: BasedSchemaFieldArray
  ) => {
    return parseRecFields(ctx, fieldSchema.values, ary)
  },
}

function parseFieldResult(
  ctx: ExecContext,
  fieldSchema: BasedSchemaField,
  v: any
) {
  const parser = FIELD_PARSERS[fieldSchema?.type]
  return parser?.(v, ctx, fieldSchema)
}
