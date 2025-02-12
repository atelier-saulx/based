import { FilterBranch } from './FilterBranch.js'

export type Filter = [fieldStr: string, ctx: FilterCtx, value: any]

export type FilterBranchFn = (filterBranch: FilterBranch) => void

export type FilterAst = (Filter | FilterAst)[]

export const IsFilter = (f: FilterAst): f is Filter => {
  if (typeof f[0] === 'string') {
    return true
  }
  return false
}

export const validOperators = [
  '=',
  'has',
  '!has',
  '<',
  '>',
  '!=',
  'like',
  '>=',
  '<=',
  '..',
  '!..',
] as const

export type Operator =
  | '='
  | 'has'
  | '!has'
  | '<'
  | '>'
  | '!='
  | 'like'
  | '>='
  | '<='
  | '..'
  | '!..'
  | 'like'

export type FilterOpts = {
  lowerCase?: boolean
  normalized?: boolean
}

// -------------------------------------------
// operations shared
export const EQUAL = 1
export const HAS = 2
export const ENDS_WITH = 4
export const STARTS_WITH = 5
export const EQUAL_CRC32 = 17
// -------------------------------------------
// operations numbers
export const GREATER_THAN = 6
export const SMALLER_THAN = 7
export const GREATER_THAN_INCLUSIVE = 8
export const SMALLER_THAN_INCLUSIVE = 9
export const RANGE = 10
export const RANGE_EXCLUDE = 11
// -------------------------------------------
// operations strings
export const EQUAL_LOWER_CASE = 12
export const HAS_TO_LOWER_CASE = 13
export const STARTS_WITH_LOWER_CASE = 14
export const ENDS_WITH_LOWER_CASE = 15
export const LIKE = 18
// -------------------------------------------

export type OPERATOR =
  | typeof EQUAL
  | typeof HAS
  | typeof ENDS_WITH
  | typeof STARTS_WITH
  | typeof GREATER_THAN
  | typeof SMALLER_THAN
  | typeof GREATER_THAN_INCLUSIVE
  | typeof SMALLER_THAN_INCLUSIVE
  | typeof RANGE
  | typeof RANGE_EXCLUDE
  | typeof EQUAL_LOWER_CASE
  | typeof HAS_TO_LOWER_CASE
  | typeof STARTS_WITH_LOWER_CASE
  | typeof ENDS_WITH_LOWER_CASE
  | typeof LIKE
  | typeof EQUAL_CRC32

// -------------------------------------------
export const isNumerical = (op: OPERATOR): boolean => {
  if (
    op === GREATER_THAN ||
    op === SMALLER_THAN ||
    op === SMALLER_THAN_INCLUSIVE ||
    op === GREATER_THAN_INCLUSIVE ||
    op === RANGE ||
    op === RANGE_EXCLUDE
  ) {
    return true
  }
  return false
}

// -------------------------------------------
// Types
export const TYPE_NEGATE = 1
export const TYPE_DEFAULT = 2
export type FILTER_TYPE = typeof TYPE_NEGATE | typeof TYPE_DEFAULT
// -------------------------------------------
// Modes
export const MODE_DEFAULT = 0
export const MODE_OR_FIXED = 1
export const MODE_OR_VAR = 2
export const MODE_AND_FIXED = 3
export const MODE_DEFAULT_VAR = 4
export const MODE_REFERENCE = 5
export type FILTER_MODE =
  | typeof MODE_DEFAULT
  | typeof MODE_OR_FIXED
  | typeof MODE_OR_VAR
  | typeof MODE_AND_FIXED
  | typeof MODE_DEFAULT_VAR
  | typeof MODE_REFERENCE
// -------------------------------------------
// Meta
export const META_EDGE = 252
export const META_OR_BRANCH = 253
export const META_REFERENCE = 254

export type FILTER_META =
  | typeof META_EDGE
  | typeof META_OR_BRANCH
  | typeof META_REFERENCE
// -------------------------------------------

export type FilterCtx = {
  operation: OPERATOR
  type: FILTER_TYPE
  opts: FilterOpts
}

export const toFilterCtx = (op: Operator, opts: FilterOpts = {}): FilterCtx => {
  if (op === '=' || op === '!=') {
    return {
      operation: EQUAL,
      type: op === '!=' ? TYPE_NEGATE : TYPE_DEFAULT,
      opts,
    }
  }

  if (op === 'has' || op === '!has') {
    return {
      operation: opts.lowerCase ? HAS_TO_LOWER_CASE : HAS,
      type: op === '!has' ? TYPE_NEGATE : TYPE_DEFAULT,
      opts,
    }
  }

  if (op === '>') {
    return { operation: GREATER_THAN, opts, type: TYPE_DEFAULT }
  }

  if (op === '<') {
    return { operation: SMALLER_THAN, opts, type: TYPE_DEFAULT }
  }

  if (op === '>=') {
    return { operation: GREATER_THAN_INCLUSIVE, opts, type: TYPE_DEFAULT }
  }

  if (op === '<=') {
    return { operation: SMALLER_THAN_INCLUSIVE, opts, type: TYPE_DEFAULT }
  }

  if (op === 'like') {
    return { operation: LIKE, opts, type: TYPE_DEFAULT }
  }

  throw new Error('Invalid filter operator')
}
