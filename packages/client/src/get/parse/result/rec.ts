import { BasedSchemaField } from '@based/schema'
import { ExecContext, GetCommand } from '../../types.js'
import { parseFieldResult } from './field.js'

export function parseRecFields(
  ctx: ExecContext,
  fieldSchema: BasedSchemaField,
  cmd: GetCommand,
  fields: any[]
): any {
  const obj: any = {}
  for (let i = 0; i < fields.length; i += 2) {
    const f = fields[i]
    const v = fields[i + 1]

    obj[f] = parseFieldResult(ctx, fieldSchema, cmd, v)
  }

  return obj
}
