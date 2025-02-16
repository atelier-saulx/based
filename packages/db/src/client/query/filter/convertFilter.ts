import { QueryDef } from '../types.js'
import { Operator } from './filter.js'
import { FilterOpts, FilterAst, toFilterCtx } from './types.js'

const normalizeNeedle = (s: string): string => {
  return s
    .normalize('NFKD')
    .split('')
    .filter((ch: string) => ch.charCodeAt(0) <= 127)
    .join('')
}

export const convertFilter = (
  def: QueryDef,
  field: string,
  operator?: Operator | boolean,
  value?: any,
  opts?: FilterOpts | undefined,
): FilterAst => {
  if (value === '' || value === undefined) {
    return
  }
  if (operator === undefined) {
    operator = '='
    value = true
  } else if (typeof operator === 'boolean') {
    value = operator
    operator = '='
  }
  if (operator === '!..') {
    return [
      [field, toFilterCtx(def, '>', opts), value[1]],
      [field, toFilterCtx(def, '<', opts), value[0]],
    ]
  } else if (operator === '..') {
    return [
      [field, toFilterCtx(def, '>', opts), value[0]],
      [field, toFilterCtx(def, '<', opts), value[1]],
    ]
  } else {
    if (operator == 'like') {
      if (value == null) {
        throw new Error('Value is required')
      }
      if (value?.normalize) {
        value = normalizeNeedle(value)
      } else if (Array.isArray(value)) {
        if (value[0]?.normalize) {
          value = value.map(normalizeNeedle)
        } else if (value[0]?.BYTES_PER_ELEMENT > 1) {
          value = value.map((v) => v.buffer)
        }
      } else if (value?.BYTES_PER_ELEMENT > 1) {
        value = value.buffer
      }
    }
    return [[field, toFilterCtx(def, operator, opts), value]]
  }
}
