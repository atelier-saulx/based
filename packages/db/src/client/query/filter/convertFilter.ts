import { QueryBranch } from '../BasedDbQuery.js'
import { Operator } from './filter.js'
import { FilterBranch } from './FilterBranch.js'
import { FilterOpts, FilterAst, toFilterCtx } from './types.js'

const normalizeNeedle = (s: string): string => {
  return s
    .normalize('NFKD')
    .split('')
    .filter((ch: string) => ch.charCodeAt(0) <= 127)
    .join('')
}

export const convertFilter = (
  query: QueryBranch<any> | FilterBranch,
  field: string,
  operator?: Operator | boolean,
  value?: any,
  opts?: FilterOpts | undefined,
): FilterAst => {
  const def = query.def

  const propFilterHook = def.schema.props[field]?.hooks?.filter
  const filterHook = def.schema.hooks?.filter
  if (propFilterHook) {
    if (typeof operator === 'boolean') {
      propFilterHook(query, field, '=', operator)
    } else {
      propFilterHook(query, field, operator, value)
    }
  }
  if (filterHook) {
    def.schema.hooks.filter = null
    if (typeof operator === 'boolean') {
      filterHook(query, field, '=', operator)
    } else {
      filterHook(query, field, operator, value)
    }
    def.schema.hooks.filter = filterHook
  }

  if (operator === undefined) {
    operator = '='
    value = true
  } else if (typeof operator === 'boolean') {
    value = operator
    operator = '='
  }
  if (
    !(operator === 'exists' || operator === '!exists') &&
    (value === '' || value === undefined)
  ) {
    // not great...
    return
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
