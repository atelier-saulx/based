import { QueryDef, IntermediateByteCode } from '../types.js'
import { isRootCountOnly } from './aggregates.js'
import {
  QueryType,
  AggHeader,
  createAggHeader,
  createAggProp,
  AggHeaderByteSize,
  AggPropByteSize,
  AggFunction,
} from '../../../zigTsExports.js'
import { getIteratorType } from '../toByteCode/iteratorType.js'

export const aggregateToBuffer = (def: QueryDef): IntermediateByteCode => {
  if (def.schema == null) {
    throw new Error('Wrong schema definition.')
  }
  if (def.aggregate == null || def.aggregate?.size == 0) {
    throw new Error('Wrong aggregate definition.')
  }

  // QueryHeader
  const filterSize = def.filter.size || 0
  const queryType = isRootCountOnly(def, filterSize)
    ? QueryType.aggregatesCount
    : QueryType.aggregates
  const hasSort = false // hardcoded
  const hasSearch = !!def.search
  const hasFilter = def.filter.size > 0
  const sortSize = 0 // hardcoded

  let aggHeader: AggHeader = {
    op: queryType,
    typeId: def.schema!.id,
    offset: def.range.offset,
    limit: def.range.limit,
    filterSize: def.filter.size,
    iteratorType: getIteratorType(def),
    size: 0, // hardcoded
    sort: false, // hardcoded
    hasGroupBy: false, // hardcoded
    resultsSize: def.aggregate.totalResultsSize,
    accumulatorSize: def.aggregate.totalAccumulatorSize,
    isSamplingSet: true, // hardcoded
  }
  const numPropsOrFuncs = [...def.aggregate.aggregates.entries()][0][1].length
  const buffer = new Uint8Array(
    AggHeaderByteSize + numPropsOrFuncs * AggPropByteSize,
  )
  const aggHeaderBuff = createAggHeader(aggHeader)
  buffer.set(aggHeaderBuff, 0)

  let aggPropMap = def.aggregate.aggregates
  let pos = AggHeaderByteSize
  for (const [propId, aggPropArray] of aggPropMap.entries()) {
    for (const aggProp of aggPropArray) {
      const aggPropBuff = createAggProp({
        propId,
        propType: aggProp.propDef.typeIndex,
        propDefStart: aggProp.propDef.start || 0,
        aggFunction: aggProp.type,
        resultPos: aggProp.resultPos,
        accumulatorPos: aggProp.accumulatorPos,
      })
      buffer.set(aggPropBuff, pos)
      pos += AggPropByteSize
    }
  }

  return { buffer, def, needsMetaResolve: def.filter.hasSubMeta }
}
