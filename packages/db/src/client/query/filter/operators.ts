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
  'hasLoose',
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
  | 'hasLoose'

// -------------------------------------------
// operations shared
export const EQUAL = 1
export const HAS = 2
export const NOT_HAS = 16
export const NOT_EQUAL = 3
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
export const HAS_NORMALIZE = 13
export const HAS_TO_LOWER_CASE = 19
export const STARTS_WITH_LOWER_CASE = 14
export const ENDS_WITH_LOWER_CASE = 15
export const LIKE = 18
// -------------------------------------------
export const NONE = 0
// -------------------------------------------
export type OPERATOR =
  | typeof EQUAL
  | typeof HAS
  | typeof NOT_HAS
  | typeof NOT_EQUAL
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
  | typeof HAS_NORMALIZE
  | typeof STARTS_WITH_LOWER_CASE
  | typeof ENDS_WITH_LOWER_CASE
  | typeof LIKE
  | typeof NONE
  | typeof EQUAL_CRC32

export const operationToByte = (op: Operator): OPERATOR => {
  if (op === '=') {
    return EQUAL
  }

  if (op === 'has') {
    return HAS
  }

  if (op === '!=') {
    return NOT_EQUAL
  }

  if (op === '!has') {
    return NOT_HAS
  }

  if (op === '>') {
    return GREATER_THAN
  }

  if (op === '<') {
    return SMALLER_THAN
  }

  if (op === '>=') {
    return GREATER_THAN_INCLUSIVE
  }

  if (op === '<=') {
    return SMALLER_THAN_INCLUSIVE
  }

  if (op === '..') {
    return RANGE
  }

  if (op === '!..') {
    return RANGE_EXCLUDE
  }

  if (op === 'like') {
    return LIKE
  }

  if (op === 'hasLoose') {
    return HAS_NORMALIZE
  }

  return NONE
}

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

// pub const Type = enum(u8) {
//   negate = 1,
//   default = 2,
// };

// pub const Mode = enum(u8) {
//   default = 0,
//   orFixed = 1,
//   orVar = 2,
//   andFixed = 3,
//   defaultVar = 4,
//   reference = 5,
// };

// pub const Meta = enum(u8) {
//   edge = 252,
//   orBranch = 253,
//   reference = 254,
//   id = 255,
//   _,
// };

export const TYPE_NEGATE = 1
export const TYPE_DEFAULT = 2

export const stripNegation = (op: OPERATOR): OPERATOR => {
  if (op === NOT_HAS) {
    return HAS
  }
  if (op === NOT_EQUAL) {
    return EQUAL
  }
  return op
}

// ----------
export const negateType = (op: number): number => {
  if (op === 3) {
    return 1
  }
  return 2
}
