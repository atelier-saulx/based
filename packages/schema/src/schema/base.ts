import type { BasedDbQuery, Operator } from '@based/db'
import type { SchemaProp } from './prop.js'
import { assert, isBoolean, isFunction, isString } from './shared.js'

type Validation = (payload: any, schema: SchemaProp<true>) => boolean | string

type SchemaPropHooks = {
  create?: (value: any, payload: Record<string, any>) => any
  update?: (value: any, payload: Record<string, any>) => any
  read?: (value: any, result: Record<string, any>) => any
  aggregate?: (query: BasedDbQuery, fields: Set<string>) => void
  search?: (query: BasedDbQuery, fields: Set<string>) => void
  groupBy?: (query: BasedDbQuery, field: string) => void
  filter?: (
    query: BasedDbQuery,
    field: string,
    operator: Operator,
    value: any,
  ) => void
  include?: (
    query: BasedDbQuery,
    fields: Map<
      string,
      {
        field: string
        opts?: any // temp this type
      }
    >,
  ) => void
}

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
