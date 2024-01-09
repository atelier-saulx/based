import {
  BasedSchemaField,
  BasedSchemaFieldArray,
  BasedSchemaFieldObject,
  BasedSchemaFieldSet,
} from '@based/schema'
import { ExecContext, GetCommand } from '../../types.js'
import { parseRecFields } from './rec.js'
import { getTypeSchema } from '../../../util/index.js'
import { parseObjFields } from './obj.js'
import { hashCmd } from '../../util.js'
import { addSubMarker } from '../../exec/cmd.js'

const FIELD_PARSERS: Record<
  string,
  (
    x: any,
    ctx?: ExecContext,
    cmd?: GetCommand,
    fieldSchema?: BasedSchemaField
  ) => any
> = {
  string: (x) => x,
  json: (x) => JSON.parse(x),
  boolean: (x) => !!x,
  number: (x) => Number(x),
  timestamp: (x) => Number(x),
  cardinality: (x) => Number(x),
  float: (x) => Number(x),
  integer: (x) => Number(x),
  text: (x, ctx: ExecContext, cmd) => {
    if (ctx.lang) {
      return x
    }

    return parseRecFields(ctx, { type: 'string' }, cmd, x)
  },
  array: (
    ary: any[],
    ctx: ExecContext,
    cmd,
    fieldSchema: BasedSchemaFieldArray
  ) => {
    const res = ary.map((x) => {
      return parseFieldResult(ctx, fieldSchema.values, cmd, x)
    })

    if (!res.length) {
      return
    }

    return res
  },
  set: (
    ary: any[],
    ctx: ExecContext,
    cmd,
    fieldSchema: BasedSchemaFieldSet
  ) => {
    const res = ary.map((x) => {
      return parseFieldResult(ctx, fieldSchema.items, cmd, x)
    })

    if (!res.length) {
      return
    }

    return res
  },
  reference: (ary: any | any[], ctx: ExecContext, cmd) => {
    if (Array.isArray(ary)) {
      if (Array.isArray(ary[0])) {
        ary = ary[0]
      }

      if (ary.length > 1) {
        const [, id, ...fields] = ary
        // We need to do some trickery here to make markers for edge de-ref
        if (ctx.subId) {
          const subCmd: GetCommand = {
            type: 'node',
            source: {
              id,
            },
            fields: { $any: [{ type: 'field', field: ['*'] }] }, // TODO: do this better, now it fires for any field change
            target: { path: [] },
          }

          subCmd.cmdId = hashCmd(subCmd)

          addSubMarker(ctx, cmd, subCmd)
        }

        const typeSchema = getTypeSchema(ctx, id)
        const obj = parseObjFields(
          ctx,
          { type: 'object', properties: typeSchema.fields },
          cmd,
          fields
        )
        return obj
      }

      return FIELD_PARSERS.references(ary, ctx)[0]
    }

    return ary
  },
  references: (ary: any[], ctx: ExecContext, cmd) => {
    const res = ary.map((x) => {
      return parseFieldResult(ctx, { type: 'string' }, cmd, x)
    })

    if (!res.length) {
      return
    }

    return res
  },
  object: (
    ary: any[],
    ctx: ExecContext,
    cmd,
    fieldSchema: BasedSchemaFieldObject
  ) => {
    return parseObjFields(ctx, fieldSchema, cmd, ary)
  },
  record: (
    ary: any[],
    ctx: ExecContext,
    cmd,
    fieldSchema: BasedSchemaFieldArray
  ) => {
    return parseRecFields(ctx, fieldSchema.values, cmd, ary)
  },
}

export function parseFieldResult(
  ctx: ExecContext,
  fieldSchema: BasedSchemaField,
  cmd: GetCommand,
  v: any
) {
  const parser = FIELD_PARSERS[fieldSchema?.type]
  return parser?.(v, ctx, cmd, fieldSchema)
}
