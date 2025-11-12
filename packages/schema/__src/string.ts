import {
  literal,
  object,
  optional,
  pipe,
  string as str,
  transform,
  union,
  type InferInput,
} from 'valibot'
import { compression, format, mime, natural } from './shared.js'
import { base } from './base.js'

const type = literal('string')
const shorthand = pipe(
  type,
  transform((type) => ({ type })),
)

export const stringOpts = object({
  type,
  default: optional(str()),
  maxBytes: optional(natural),
  max: optional(natural),
  min: optional(natural),
  mime: optional(mime),
  format: optional(format),
  compression: optional(compression),
  ...base.entries,
})

export const string = union([shorthand, stringOpts])
