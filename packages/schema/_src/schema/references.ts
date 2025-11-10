import type { Schema } from './index.js'
import { parseReference, type SchemaReference } from './reference.js'
import { getValidate, isRecord, type RequiredIfStrict } from './shared.js'

export type SchemaReferences<strict = true> = {
  type: RequiredIfStrict<'references', strict>
  items: SchemaReference<strict>
}

const validate = getValidate<SchemaReferences<false>, SchemaReferences<true>>(
  'references',
  {
    items: isRecord,
  },
  {},
)

export const parseReferences = (
  def: unknown,
  schema: Schema,
): SchemaReferences => {
  const res = validate(def)
  res.items = parseReference(res.items, schema)
  return res
}
