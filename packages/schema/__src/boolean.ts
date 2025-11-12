import {
  boolean as bool,
  literal,
  object,
  optional,
  pipe,
  transform,
  union,
} from 'valibot'
import { base } from './base.js'

const type = literal('boolean')
const schema = object({
  type,
  default: optional(bool()),
  ...base.entries,
})
const shorthand = pipe(
  type,
  transform((type) => ({ type })),
)

export const boolean = union([shorthand, schema])
