import { any, literal, object, optional, pipe, transform, union } from 'valibot'
import { base } from './base.js'

const type = literal('json')
const schema = object({
  type,
  default: optional(any()),
  ...base.entries,
})
const shorthand = pipe(
  type,
  transform((type) => ({ type })),
)

export const json = union([shorthand, schema])
