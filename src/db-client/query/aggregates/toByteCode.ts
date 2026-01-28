import { QueryDef, IntermediateByteCode } from '../types.js'
import { byteSize } from '../toByteCode/utils.js'
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
import { filterToBuffer } from '../filter/toByteCode.js'
import { combineIntermediateResults } from '../query.js'

export const aggregateToBuffer = (def: QueryDef): IntermediateByteCode => {
  if (def.schema == null) {
    throw new Error('Wrong schema definition.')
  }
  if (def.aggregate == null || def.aggregate?.size == 0) {
    throw new Error('Wrong aggregate definition.')
  }

  // QueryHeader
  const filter = filterToBuffer(def.filter)
  def.filter.conditions
  const filterSize = byteSize(filter) || 0
  const hasFilter = filterSize > 0

  const queryType = isRootCountOnly(def, filterSize)
    ? QueryType.aggregatesCount
    : QueryType.aggregates

  const hasSort = false // hardcoded
  // const hasSearch = !!def.search
  const sortSize = 0 // hardcoded
  let pos = 0

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
  const groupByKeyPropByteSize = hasGroupBy ? GroupByKeyPropByteSize : 0
  const buffer = new Uint8Array(
    AggHeaderByteSize +
      filterSize +
      numPropsOrFuncs * AggPropByteSize +
      groupByKeyPropByteSize,
  )
  const aggHeaderBuff = createAggHeader(aggHeader)
  buffer.set(aggHeaderBuff, pos)
  pos += AggHeaderByteSize

  if (hasFilter) {
    const filterBuff = new Uint8Array(filterSize)
    combineIntermediateResults(filterBuff, 0, filter)
    buffer.set(filterBuff, pos)
    pos += filterSize
  }

  let aggPropMap = def.aggregate.aggregates

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
