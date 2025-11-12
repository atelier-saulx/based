import { boolean, custom, object, optional, string } from 'valibot'
import type { SchemaProp } from './prop.js'

export type Validation = (
  payload: unknown,
  schema: SchemaProp<true>,
) => boolean | string

export const base = object({
  required: optional(boolean()),
  title: optional(string()),
  description: optional(string()),
  validation: optional(custom<Validation>((v) => typeof v === 'function')),
})
