import type { Validation } from '../index.js'
import { assert, isBoolean, isFunction, isString } from './shared.js'

export type Base = {
  required?: boolean
  title?: string
  description?: string
  validation?: Validation
  // hooks?: SchemaPropHooks
}

const isValidation = (v: unknown): v is Validation => isFunction(v)

export const parseBase = <T extends Base>(
  def: Record<string, unknown>,
  result: T,
): T => {
  assert(def.required === undefined || isBoolean(def.required))
  assert(def.title === undefined || isString(def.title))
  assert(def.description === undefined || isString(def.description))
  assert(def.validation === undefined || isValidation(def.validation))

  result.required = def.required
  result.title = def.title
  result.description = def.description
  result.validation = def.validation

  if ('default' in def) {
    // validate default here
    console.warn('TODO validate default here!')
  }

  assert(
    Object.keys(def).every((key) => key in result),
    'Unexpected key',
  )

  return result
}
