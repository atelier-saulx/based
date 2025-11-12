import { literal, object, optional } from 'valibot'
import { reference } from './reference.js'
import { base } from './base.js'

export const references = object({
  type: optional(literal('references'), 'references'),
  items: reference,
  ...base.entries,
})
