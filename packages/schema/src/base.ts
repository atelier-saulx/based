import { boolean, custom, object, optional, string } from 'valibot'
import type { Validation } from '../index.js'

export const base = object({
  required: optional(boolean()),
  title: optional(string()),
  description: optional(string()),
  validation: optional(custom<Validation>((v) => typeof v === 'function')),
})
