import { QuerySubTypeEnum } from '../../../zigTsExports.js'

export const getQuerySubType = (
  filterSize: number,
  sortSize: number,
  searchSize: number,
  isDesc: boolean,
  isIdSort: boolean,
  isVector: boolean,
): QuerySubTypeEnum => {
  const hasSearch = searchSize > 0
  const hasSort = sortSize > 0
  const hasFilter = filterSize > 0
  if (hasSearch && isVector) {
    if (isIdSort) return hasFilter ? 23 : 22
    if (hasSort) {
      if (isDesc) return hasFilter ? 21 : 20
      return hasFilter ? 19 : 18
    }
    return hasFilter ? 17 : 16
  }
  if (hasSearch) {
    if (isIdSort) return hasFilter ? 15 : 14
    if (hasSort) {
      if (isDesc) return hasFilter ? 13 : 12
      return hasFilter ? 11 : 10
    }
    return hasFilter ? 9 : 8
  }
  if (hasSort) {
    if (isIdSort) return hasFilter ? 7 : 6
    if (isDesc) return hasFilter ? 5 : 4
    return hasFilter ? 3 : 2
  }
  return hasFilter ? 1 : 0
}
