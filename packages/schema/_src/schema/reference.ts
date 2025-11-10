import { parseProp, Schema, SchemaProp } from './index.js'
import {
  assert,
  getValidate,
  isRecord,
  isString,
  RequiredIfStrict,
} from './shared.js'

export type SchemaReference<strict = true> = {
  type: RequiredIfStrict<'reference', strict>
  ref: string
  prop: string
  [edge: `$${string}`]: SchemaProp
}

const validate = getValidate<SchemaReference<false>, SchemaReference<true>>(
  'reference',
  {
    ref: isString,
    prop: isString,
  },
  {},
)

export const parseReference = (
  def: unknown,
  schema: Schema,
): SchemaReference => {
  assert(isRecord(def))
  const props = {}
  const edges = {}
  for (const key in def) {
    if (key.startsWith('$')) {
      edges[key] = parseProp(edges[key], schema)
    } else {
      props[key] = def[key]
    }
  }
  return Object.assign(validate(props), edges)
}
