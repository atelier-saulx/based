import {
  BasedSchemaField,
  BasedSchemaFieldArray,
  BasedSchemaFieldObject,
  BasedSchemaFieldSet,
  BasedSchemaType,
} from '@based/schema'
import { deepMerge, getByPath, setByPath } from '@saulx/utils'
import { parseAlias } from '../../util'
import { ExecContext, GetCommand } from '../types'

function getTypeSchema(ctx: ExecContext, id: string): BasedSchemaType {
  const typeName = ctx.client.schema.prefixToTypeMapping[id.slice(0, 2)]
  return typeName === 'root'
    ? ctx.client.schema.root
    : ctx.client.schema.types[typeName]
}

export function parseGetResult(
  ctx: ExecContext,
  cmds: GetCommand[],
  results: any[]
): any {
  console.dir({ results }, { depth: 8 })
  let obj = {}
  for (let i = 0; i < results.length; i++) {
    const result = results[i][0]
    const cmd: GetCommand = cmds[i]
    const {
      type,
      target: { path },
    } = cmd

    const parsed =
      type === 'aggregate' ||
      (cmd.type === 'ids' && cmd.mainType === 'aggregate')
        ? Number(result)
        : parseResultRows({ ...ctx, commandPath: path }, result)

    // if it's a top level $list expression, just return in straight up
    if (
      !path.length &&
      (type === 'traverse' ||
        (cmd.type === 'ids' && cmd.mainType === 'traverse')) &&
      !cmd.isSingle
    ) {
      return parsed
    }

    if (!path.length) {
      obj = { ...obj, ...parsed[0] }
    } else {
      if (cmd.type === 'node') {
        const v = parsed[0]
        const cur = getByPath(obj, path)
        const o = deepMerge({}, cur, v)
        setByPath(obj, path, o)
      } else if (cmd.type === 'traverse' && cmd.isSingle) {
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
    const rowCtx = { ...ctx, fieldAliases: {} }

    if (!row) {
      return {}
    }

    const [id, fields]: [string, any[]] = row

    const typeSchema = getTypeSchema(rowCtx, id)
    if (!typeSchema) {
      return {}
    }

    const obj =
      parseObjFields(
        rowCtx,
        { type: 'object', properties: typeSchema.fields },
        fields
      ) || {}

    for (const path in rowCtx.fieldAliases) {
      setResultValue({ obj, path, ...rowCtx.fieldAliases[path] })
    }

    return obj
  })
}

function parseObjFields(
  ctx: ExecContext,
  schema: BasedSchemaField,
  fields: any[]
): any {
  // arrays with objects can have empty objects that are returned as null
  if (!fields && schema.type === 'object') {
    return {}
  }

  let keys: number = 0
  const obj: any = {}
  for (let i = 0; i < fields.length; i += 2) {
    const f = fields[i]
    const v = fields[i + 1]
    let fieldSchema = schema

    const [alias, rest] = f.split('@')

    const parts = (rest ?? alias).split('.')
    for (let i = 0; i < parts.length - 1; i++) {
      const s = parts[i]

      if ((<BasedSchemaFieldObject>fieldSchema).properties) {
        fieldSchema = (<BasedSchemaFieldObject>fieldSchema).properties[s]
      } else if (fieldSchema.type === 'record') {
        // @ts-ignore
        fieldSchema = fieldSchema.values
      }
    }

    if ((<BasedSchemaFieldObject>fieldSchema).properties) {
      fieldSchema = (<BasedSchemaFieldObject>fieldSchema).properties[
        parts[parts.length - 1]
      ]
    } else if (fieldSchema.type === 'record') {
      // @ts-ignore
      fieldSchema = fieldSchema.values
    } else if (fieldSchema.type === 'text') {
      fieldSchema = { type: 'string' }
    }

    const res = parseFieldResult(ctx, fieldSchema, v)
    if (res === undefined) {
      continue
    }

    if (rest) {
      ctx.fieldAliases[alias] = { value: res, fieldSchema }
      continue
    }

    setResultValue({ path: alias, obj, value: res, fieldSchema })
    keys++
  }

  if (!keys) {
    return
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
  reference: (ary: any | any[], ctx: ExecContext) => {
    if (Array.isArray(ary)) {
      if (Array.isArray(ary[0])) {
        ary = ary[0]
      }

      if (ary.length > 1) {
        const [, id, ...fields] = ary
        const typeSchema = getTypeSchema(ctx, id)
        const obj = parseObjFields(
          ctx,
          { type: 'object', properties: typeSchema.fields },
          fields
        )
        return obj
      }

      return FIELD_PARSERS.references(ary, ctx)[0]
    }

    return ary
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

function setResultValue({
  path,
  fieldSchema,
  obj,
  value,
}: {
  path: string
  fieldSchema: BasedSchemaField
  obj: any
  value: any
}) {
  const parsedPath = parseAlias(path)
  if (['object', 'record', 'text', 'reference'].includes(fieldSchema.type)) {
    const currentValue = getByPath(obj, parsedPath)
    if (typeof currentValue === 'object') {
      deepMerge(currentValue, value)
    } else {
      setByPath(obj, parsedPath, value)
    }
  } else {
    setByPath(obj, parsedPath, value)
  }
}
