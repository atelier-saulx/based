import { QueryDef, QueryDefType } from '../types.js'
import { AggFunction } from '../../../zigTsExports.js'

export const isRootCountOnly = (def: QueryDef, filterSize: number) => {
  if (filterSize != 0) {
    return false
  }
  if (def.type !== QueryDefType.Root) {
    return false
  }
  const aggregate = def.aggregate!
  if (aggregate.groupBy) {
    return false
  }
  if (aggregate.aggregates.size !== 1) {
    return false
  }
  if (!aggregate.aggregates.has(255)) {
    return false
  }
  const aggs = aggregate.aggregates.get(255)!
  if (aggs.length !== 1) {
    return false
  }
  if (aggs[0].type !== AggFunction.count) {
    return false
  }
  if (def.filter && def.filter.size > 0) {
    return false
  }
  return true
}
