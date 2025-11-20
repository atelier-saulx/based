import {
  assert,
  deleteUndefined,
  isBoolean,
  isFunction,
  isString,
} from './shared.js'
import type { SchemaProp } from './prop.js'
import { isHooks, type SchemaPropHooks } from './hooks.js'

type Validation = (payload: any, schema: SchemaProp<true>) => boolean | string

export type Base = {
  required?: boolean
  title?: string
  description?: string
  validation?: Validation
  hooks?: SchemaPropHooks
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
  assert(def.hooks === undefined || isHooks(def.hooks))

  result.required = def.required
  result.title = def.title
  result.description = def.description
  result.validation = def.validation
  result.hooks = def.hooks

  if ('default' in def) {
    // validate default here
    console.warn('TODO validate default here!')
  }

  assert(
    Object.keys(def).every((key) => key in result),
    'Unexpected key',
  )

  return deleteUndefined(result)
}
