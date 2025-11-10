import type { Validation } from '../index.js'
import { parseProp, Schema } from './index.js'
import { assert, isBoolean, isFunction, isRecord, isString } from './shared.js'

export type Base = {
  required?: boolean
  title?: string
  description?: string
  validation?: Validation
  // hooks?: SchemaPropHooks
}

export const parseBase = (def: unknown): [Base, Record<string, unknown>] => {
  assert(isRecord(def))
  const { required, title, description, validation, ...rest } = def
  assert(required === undefined || isBoolean(required))
  assert(title === undefined || isString(title))
  assert(description === undefined || isString(description))
  assert(validation === undefined || isFunction(validation))
  return [
    {
      required,
      title,
      description,
      validation: validation as Validation,
    },
    rest,
  ]
}
