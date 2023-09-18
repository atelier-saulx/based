import {
  BasedSchemaField,
  BasedSchemaFieldArray,
  BasedSchemaFieldObject,
} from '@based/schema'
import { ExecContext, Field, GetCommand } from '../../types'
import { setResultValue } from './setResultValue'
import { parseFieldResult } from './field'
import { joinPath } from '../../../util'
import { setByPath } from '@saulx/utils'

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
    fieldSchema = (<BasedSchemaFieldArray>fieldSchema).values
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

    const [alias, rest] = f.split('@')

    if ((rest ?? alias).startsWith('$edgeMeta')) {
      if (v[1] === '') {
        v = v[2]
      } else {
        v = v.slice(1)
      }

      const res: any = {}
      for (let j = 0; j < v.length; j += 2) {
        const vv = typeof v[j + 1] === 'string' ? v[j + 1] : Number(v[j + 1])
        setByPath(res, v[j].split('.'), vv)
      }

      if (rest) {
        ctx.fieldAliases[alias] = {
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
      }

      keys++

      continue
    }

    let fieldSchema = findFieldSchema(rest ?? alias, schema)

    // TODO: handle fields by type
    // const fs = cmd?.fields?.byType[schema?.type] ?? cmd?.fields?.$any
    const fs = cmd?.fields?.$any
    const field = fs.find((f) => {
      return joinPath(f.field) === alias
    })

    if (field?.inherit) {
      const typeFields =
        ctx.client.schema?.types[
          ctx.client.schema.prefixToTypeMapping[v[0].slice(0, 2)]
        ]?.fields

      if (typeFields) {
        fieldSchema = findFieldSchema(rest ?? alias, {
          type: 'object',
          properties: typeFields,
        })
      }

      v = v[1]
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
