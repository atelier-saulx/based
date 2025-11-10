import {
  array,
  literal,
  object,
  optional,
  pipe,
  transform,
  union,
} from 'valibot'
import { base } from './base.js'
import { enumType } from './shared.js'

const enumArr = array(enumType)
const schema = object({
  type: optional(literal('enum'), 'enum'),
  default: optional(enumType),
  enum: enumArr,
  ...base.entries,
})
const shorthand = pipe(
  enumArr,
  transform((e) => ({ enum: e })),
)

export const enum_ = union([shorthand, schema])
