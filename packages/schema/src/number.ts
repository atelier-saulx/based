import {
  number as num,
  object,
  optional,
  pipe,
  transform,
  union,
} from 'valibot'
import { positive, numberTypes as type } from './shared.js'
import { base } from './base.js'

const schema = object({
  type,
  default: optional(num()),
  min: optional(num()),
  max: optional(num()),
  step: optional(positive),
  ...base.entries,
})
const shorthand = pipe(
  type,
  transform((type) => ({ type })),
)

export const number = union([shorthand, schema])
