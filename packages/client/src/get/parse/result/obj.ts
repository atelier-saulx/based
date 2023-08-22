import { BasedSchemaField, BasedSchemaFieldObject } from '@based/schema'
import { ExecContext } from '../../types'
import { setResultValue } from './setResultValue'
import { parseFieldResult } from './field'

export function parseObjFields(
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
