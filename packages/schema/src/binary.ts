import {
  instance,
  literal,
  number,
  object,
  optional,
  pipe,
  transform,
  union,
} from 'valibot'
import { format, mime } from './shared.js'
import { base } from './base.js'

const type = literal('binary')
const schema = object({
  type,
  default: optional(instance(Uint8Array)),
  maxBytes: optional(number()),
  mime: optional(mime),
  format: optional(format),
  ...base.entries,
})
const shorthand = pipe(
  type,
  transform((type) => ({ type })),
)

export const binary = union([shorthand, schema])
