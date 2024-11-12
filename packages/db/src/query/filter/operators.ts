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

// -------------------------------------------
// operations shared
// 1 = equality
// 2 = has (simd)
// 3 = not equal
// 4 = ends with
// 5 = starts with
// -------------------------------------------
// operations numbers
// 6 = larger then
// 7 = smaller then
// 8 = larger then inclusive
// 9 = smaller then inclusive
// 10 = range
// 11 = exclude range

// -------------------------------------------
// operations strings
// 12 = equality to lower case
// 13 = has to lower case (simd)
// 14 = starts with to lower case
// 15 = ends with to lower case
// -------------------------------------------

export const operationToByte = (op: Operator) => {
  if (op === '=') {
    return 1
  }

  if (op === 'has') {
    return 2
  }

  if (op === '!=') {
    return 3
  }

  if (op === '!has') {
    return 16
  }

  if (op === '>') {
    return 6
  }

  if (op === '<') {
    return 7
  }

  if (op === '>=') {
    return 8
  }

  if (op === '<=') {
    return 9
  }

  if (op === '..') {
    return 10
  }

  if (op === '!..') {
    return 11
  }

  return 0
}

export const isNumerical = (op: number): boolean => {
  if (op === 6 || op === 7 || op === 8 || op === 9 || op === 10 || op === 11) {
    return true
  }
  return false
}

export const stripNegation = (op: number): number => {
  if (op === 3 || op === 16) {
    return 1
  }
  return op
}

export const negateType = (op: number): number => {
  if (op === 3 || op === 16) {
    return 1
  }
  return 2
}
