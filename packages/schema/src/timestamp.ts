import {
  date,
  literal,
  object,
  optional,
  pipe,
  transform,
  union,
} from 'valibot'
import { base } from './base.js'

const type = literal('timestamp')
const schema = object({
  type,
  default: optional(date()),
  ...base.entries,
})
const shorthand = pipe(
  type,
  transform((type) => ({ type })),
)

export const timestamp = union([shorthand, schema])
