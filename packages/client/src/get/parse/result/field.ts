import {
  BasedSchemaField,
  BasedSchemaFieldArray,
  BasedSchemaFieldObject,
  BasedSchemaFieldSet,
} from '@based/schema'
import { ExecContext } from '../../types'
import { parseRecFields } from './rec'
import { getTypeSchema } from '../../../util'
import { parseObjFields } from './obj'

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

export function parseFieldResult(
  ctx: ExecContext,
  fieldSchema: BasedSchemaField,
  v: any
) {
  const parser = FIELD_PARSERS[fieldSchema?.type]
  return parser?.(v, ctx, fieldSchema)
}
