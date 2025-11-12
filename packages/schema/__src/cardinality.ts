import {
  literal,
  object,
  optional,
  picklist,
  pipe,
  transform,
  union,
} from 'valibot'
import { natural } from './shared.js'
import { base } from './base.js'

const type = literal('cardinality')
const schema = object({
  type,
  maxBytes: optional(natural),
  precision: optional(natural),
  mode: optional(picklist(['sparse', 'dense'])),
  ...base.entries,
})
const shorthand = pipe(
  type,
  transform((type) => ({ type })),
)

export const cardinality = union([shorthand, schema])
