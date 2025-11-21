import {
  assert,
  deleteUndefined,
  isBoolean,
  isFunction,
  isString,
} from './shared.js'
import type { SchemaProp } from './prop.js'
import { isHooks, type SchemaPropHooks } from './hooks.js'
import { getValidator } from '../def/validation.js'

type Validation = (payload: any, schema: SchemaProp<true>) => boolean | string

export type Base = {
  required?: boolean
  title?: string
  description?: string
  validation?: Validation
  hooks?: SchemaPropHooks
}

const isValidation = (v: unknown): v is Validation => isFunction(v)

export const parseBase = <T extends SchemaProp<true>>(
  def: Record<string, unknown>,
  result: T,
): T => {
  assert(
    def.required === undefined || isBoolean(def.required),
    'Required should be boolean',
  )
  assert(
    def.title === undefined || isString(def.title),
    'Title should be string',
  )
  assert(
    def.description === undefined || isString(def.description),
    'Description should be string',
  )
  assert(
    def.validation === undefined || isValidation(def.validation),
    'Invalid validation',
  )
  assert(def.hooks === undefined || isHooks(def.hooks), 'Invalid hooks')

  result.required = def.required
  result.title = def.title
  result.description = def.description
  result.validation = def.validation
  result.hooks = def.hooks

  const unexpectedKey = Object.keys(def).find((key) => !(key in result))
  assert(unexpectedKey === undefined, `Unexpected property: ${unexpectedKey}`)

  if ('default' in result && result.default !== undefined) {
    const validation = getValidator(result)
    assert(
      validation(def.default, result),
      `Default should be valid ${('format' in result && result.format) || result.type}`,
    )
    result.default = def.default
  }

  return deleteUndefined(result)
}
