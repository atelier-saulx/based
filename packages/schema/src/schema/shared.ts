import type { Schema, SchemaProp } from './index.js'

export const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null

export const isEmpty = (v: object) => Object.keys(v).length === 0
export const isString = (v: unknown): v is string => typeof v === 'string'
export const isBoolean = (v: unknown): v is boolean => typeof v === 'boolean'
export const isFunction = (v: unknown): v is Function => typeof v === 'function'
export const isNumber = (v: unknown): v is number => typeof v === 'number'
export const isInteger = (v: unknown): v is number =>
  isNumber(v) && Number.isSafeInteger(v)
export const isNatural = (v: unknown): v is number => isInteger(v) && v > 0

export function assert(condition: unknown, msg?: string): asserts condition {
  if (!condition) throw msg || 'unexpected error'
}

export type RequiredIfStrict<value, strict> = strict extends true
  ? value
  : value | undefined

type Test<S> = string | ((v: unknown, def: S) => boolean)
export type RequiredTests<T> = {
  [K in keyof T as undefined extends T[K]
    ? never
    : K extends 'type'
      ? never
      : K]: Test<T>
}
export type OptionalTests<T> = {
  [K in keyof T as undefined extends T[K]
    ? K extends 'type'
      ? never
      : K
    : never]: Test<T>
}
export const getValidate = <In extends { type?: string }, Out>(
  type: In['type'],
  required: RequiredTests<In>,
  optional: OptionalTests<In>,
) => {
  return (def: unknown): Out => {
    assert(isRecord(def))
    const res = { type }
    // check required
    for (const key in required) {
      const test = required[key]
      const val = def[key]
      assert(val !== undefined)
      if (typeof test === 'function') {
        assert(test(val, def as In))
      } else {
        assert(val === test)
      }
      res[key as any] = val
    }

    // check optionals
    for (const key in def) {
      const test = optional[key]
      const val = def[key]
      if (val !== undefined) {
        assert(test !== undefined)
        if (typeof test === 'function') {
          assert(test(val, def))
        } else {
          assert(val === test)
        }
        res[key] = val
      }
    }
    return res as Out
  }
}
