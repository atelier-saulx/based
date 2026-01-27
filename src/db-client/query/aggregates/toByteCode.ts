import { QueryDef, IntermediateByteCode } from '../types.js'
import { isRootCountOnly } from './aggregates.js'
import {
  QueryType,
  AggHeader,
  createAggHeader,
  createAggProp,
  createGroupByKeyProp,
  GroupByKeyPropByteSize,
  AggHeaderByteSize,
  AggPropByteSize,
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
  const filterSize = 0 // def.filter.size later...
  const queryType = isRootCountOnly(def, filterSize)
    ? QueryType.aggregatesCount
    : QueryType.aggregates
  const hasSort = false // hardcoded
  // const hasSearch = !!def.search
  // const hasFilter = def.filter.size > 0
  const sortSize = 0 // hardcoded

  let aggHeader: AggHeader = {
    op: queryType,
    typeId: def.schema!.id,
    offset: def.range.offset,
    limit: def.range.limit,
    filterSize,
    iteratorType: getIteratorType(def, false),
    size: 0, // hardcoded
    sort: false, // hardcoded
    hasGroupBy: def.aggregate.groupBy ? true : false,
    resultsSize: def.aggregate.totalResultsSize,
    accumulatorSize: def.aggregate.totalAccumulatorSize,
    isSamplingSet: (def.aggregate?.option?.mode || 'sample') === 'sample',
  }
  const numPropsOrFuncs = [...def.aggregate.aggregates.values()].reduce(
    (sum, arr) => sum + arr.length,
    0,
  )
  const hasGroupBy = aggHeader.hasGroupBy
  const buffer = new Uint8Array(
    AggHeaderByteSize +
      numPropsOrFuncs * AggPropByteSize +
      (hasGroupBy ? GroupByKeyPropByteSize : 0),
  )
  const aggHeaderBuff = createAggHeader(aggHeader)
  buffer.set(aggHeaderBuff, 0)

  let aggPropMap = def.aggregate.aggregates
  let pos = AggHeaderByteSize
  if (def.aggregate.groupBy) {
    const gp = def.aggregate.groupBy
    const groupByKeyPropDef = createGroupByKeyProp({
      propId: gp.prop,
      propType: gp.typeIndex,
      propDefStart: gp.start,
      stepType: gp.stepType || 0,
      stepRange: gp.stepRange || 0,
      timezone: gp.tz || 0,
    })
    buffer.set(groupByKeyPropDef, pos)
    pos += GroupByKeyPropByteSize
  }
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

  // here we do need to pass the filter thing as well
  return buffer
}
