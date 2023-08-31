import { BasedSchemaField, BasedSchemaFieldObject } from '@based/schema'
import { ExecContext, Field, GetCommand } from '../../types'
import { setResultValue } from './setResultValue'
import { parseFieldResult } from './field'
import { joinPath } from '../../../util'

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

    // TODO: handle fields by type
    // const fs = cmd?.fields?.byType[schema?.type] ?? cmd?.fields?.$any
    const fs = cmd?.fields?.$any
    const field = fs.find((f) => {
      return joinPath(f.field) === alias
    })

    if (field?.inherit) {
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
