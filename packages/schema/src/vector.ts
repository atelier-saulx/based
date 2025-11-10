import { number, object, optional, picklist } from 'valibot'
import { vectorBaseTypes, vectorType } from './shared.js'
import { base } from './base.js'

export const vector = object({
  type: picklist(['vector', 'colvec']),
  default: optional(vectorType),
  size: number(),
  baseType: vectorBaseTypes,
  ...base.entries,
})
