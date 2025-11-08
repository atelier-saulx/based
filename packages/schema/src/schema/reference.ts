import { ParseProp, parseProp, SchemaProp } from './index.js'
import { assert, isRecord, isString, RequiredIfStrict } from './shared.js'

export type SchemaReference<strict = true> = {
  type: RequiredIfStrict<'reference', strict>
  ref: string
  prop: string
  [edge: `$${string}`]: SchemaProp
}

export const parseReference: ParseProp<SchemaReference> = (def, schema) => {
  assert(isRecord(def))
  const { type, ref, prop, ...edges } = def
  assert(type === undefined || type === 'reference')
  assert(isString(ref))
  assert(ref in schema.types)
  assert(isString(prop))
  for (const key in edges) {
    assert(key.startsWith('$'))
    edges[key] = parseProp(edges[key], schema)
  }
  return {
    type: 'reference',
    ref,
    prop,
    ...edges,
  }
}
