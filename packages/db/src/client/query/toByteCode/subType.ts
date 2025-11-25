import { ID_PROP, QuerySubTypeEnum, SortOrder } from '../../../zigTsExports.js'
import { QueryDef } from '../types.js'

export const getQuerySubType = (def: QueryDef): QuerySubTypeEnum => {
  let isIdSort = def.sort?.prop === ID_PROP
  const hasSort = !isIdSort && !!def.sort
  const hasSearch = def.search?.size && def.search.size > 0
  const hasFilter = def.filter.size > 0
  const isVector = hasSearch && def.search!.isVector
  const isDesc = hasSort && def.sort!.order == SortOrder.desc
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
