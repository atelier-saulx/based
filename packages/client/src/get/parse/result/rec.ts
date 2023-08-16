import { BasedSchemaField } from '@based/schema'
import { ExecContext } from '../../types'
import { parseFieldResult } from './field'

export function parseRecFields(
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
