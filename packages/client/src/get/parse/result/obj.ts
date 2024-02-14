import {
  BasedSchemaField,
  BasedSchemaFieldArray,
  BasedSchemaFieldObject,
} from '@based/schema'
import { ExecContext, GetCommand } from '../../types.js'
import { setResultValue } from './setResultValue.js'
import { parseFieldResult } from './field.js'
import { deepCopy, setByPath } from '@saulx/utils'
import { hashCmd } from '../../util.js'
import { addSubMarker } from '../../exec/cmd.js'

export function findFieldSchema(
  f: string,
  fieldSchema: BasedSchemaField
): BasedSchemaField {
  const parts = f.split('.')

  for (let i = 0; i < parts.length - 1; i++) {
    const s = parts[i]

    if ((<BasedSchemaFieldObject>fieldSchema).properties) {
      fieldSchema =
        (<BasedSchemaFieldObject>fieldSchema).properties[s] ?? fieldSchema
    } else if (fieldSchema.type === 'record') {
      // @ts-ignore
      fieldSchema = fieldSchema.values
    } else if (fieldSchema.type === 'array') {
      // @ts-ignore
      fieldSchema = fieldSchema.values
    } else if (fieldSchema.type === 'any') {
      return { type: 'any' }
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
  } else if (fieldSchema.type === 'array') {
    fieldSchema = (<BasedSchemaFieldArray>fieldSchema).items
  }

  return fieldSchema
}

export function parseObjFields(
  ctx: ExecContext,
  schema: BasedSchemaField,
  cmd: GetCommand,
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
    let v = fields[i + 1]

    if (f === '$edgeMeta') {
      const edgeField = v[0]
      if (edgeField === '' || edgeField.endsWith('@')) {
        v = v[1]
      }

      const res: any = {}
      let nkeys = 0
      for (let j = 0; j < v.length; j += 2) {
        const nf = v[j]

        const [alias, rest] = nf.split('@')

        const vv = typeof v[j + 1] === 'string' ? v[j + 1] : Number(v[j + 1])

        if (rest) {
          ctx.fieldAliases[alias] = {
            value: vv,
            fieldSchema: { type: 'object', properties: {} },
          }
          continue
        }

        setByPath(res, nf.split('.'), vv)
        nkeys++
      }

      if (edgeField.endsWith('@')) {
        ctx.fieldAliases[edgeField.slice(0, -1)] = {
          value: res,
          fieldSchema: { type: 'object', properties: {} },
        }
      } else {
        setResultValue({
          path: f,
          obj,
          value: res,
          fieldSchema: { type: 'object', properties: {} },
        })

        if (nkeys) {
          keys++
        }
      }

      continue
    } else if (f === '$depth') {
      setResultValue({
        path: f,
        obj,
        value: v,
        fieldSchema: { type: 'integer' },
      })
      continue
    }

    let [alias, rest] = f.split('@')
    let fieldSchema = findFieldSchema(rest ?? alias, schema)

    if (f.startsWith('^')) {
      // is inherit

      let inh: string
      ;[inh, alias] = alias.split(':')

      if (ctx.subId) {
        const types = inh
          .slice(1)
          .split(',')
          .map((prefix) => {
            if (prefix === 'ro') {
              return 'root'
            }

            return ctx.client.schema.prefixToTypeMapping[prefix]
          })
          .filter((type) => !!type)

        const subCmd: GetCommand = {
          type: 'traverse',
          source: deepCopy(cmd.source),
          fields: { $any: [{ type: 'field', field: [rest ?? alias] }] }, // TODO: do this better, now it fires for any field change
          target: { path: [] },
          sourceField: 'ancestors',
        }

        if (types.length) {
          subCmd.filter = {
            $field: 'type',
            $operator: '=',
            $value: types,
          }
        }

        subCmd.cmdId = hashCmd(subCmd)

        addSubMarker(ctx, cmd, subCmd)
      }

      const typeFields =
        v[0] === 'root'
          ? ctx.client.schema?.root?.fields
          : ctx.client.schema?.types[
              ctx.client.schema.prefixToTypeMapping[v[0].slice(0, 2)]
            ]?.fields

      if (typeFields) {
        fieldSchema = findFieldSchema(rest ?? alias, {
          type: 'object',
          properties: typeFields,
        })
      }

      v = v[1]

      // inherited null values should be omitted
      if (v === null) {
        v = undefined
      }
    }

    const res = parseFieldResult(ctx, fieldSchema, cmd, v)
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
