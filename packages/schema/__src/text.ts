import {
  literal,
  object,
  optional,
  pipe,
  record,
  string,
  transform,
  union,
} from 'valibot'
import { compression, format } from './shared.js'
import { base } from './base.js'

const type = literal('text')
const schema = object({
  type,
  default: optional(record(string(), string())),
  format: optional(format),
  compression: optional(compression),
  ...base.entries,
})
const shorthand = pipe(
  type,
  transform((type) => ({ type })),
)

export const text = union([schema, shorthand])
