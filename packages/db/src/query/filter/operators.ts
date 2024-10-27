export type Operator =
  | '='
  | 'has'
  | '<'
  | '>'
  | '!='
  | 'like'
  | '>='
  | '<='
  | 'exists'
  | '!exists'

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

  if (op === '>') {
    return 6
  }

  if (op === '<') {
    return 7
  }

  return 0
}
