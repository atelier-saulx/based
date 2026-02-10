import { QueryDef, QueryDefType, IntermediateByteCode } from '../types.js'
import { byteSize } from '../toByteCode/utils.js'
import { isRootCountOnly } from './aggregates.js'
import {
  QueryType,
  AggHeader,
  AggRefsHeader,
  createAggHeader,
  createAggRefsHeader,
  createAggProp,
  createGroupByKeyProp,
  GroupByKeyPropByteSize,
  AggHeaderByteSize,
  AggRefsHeaderByteSize,
  AggPropByteSize,
  IncludeOp,
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
  const filterSize = byteSize(filter) || 0
  const hasFilter = filterSize > 0
  const hasGroupBy = def.aggregate.groupBy ? true : false
  const numPropsOrFuncs = [...def.aggregate.aggregates.values()].reduce(
    (sum, arr) => sum + arr.length,
    0,
  )
  const groupByKeyPropByteSize = hasGroupBy ? GroupByKeyPropByteSize : 0

  const commonHeader = {
    offset: def.range.offset,
    filterSize,
    hasGroupBy,
    resultsSize: def.aggregate.totalResultsSize,
    accumulatorSize: def.aggregate.totalAccumulatorSize,
    isSamplingSet: (def.aggregate?.option?.mode || 'sample') === 'sample',
  }
  let headerBuffer: Uint8Array

  if (def.type == QueryDefType.References) {
    headerBuffer = createAggRefsHeader({
      ...commonHeader,
      op: IncludeOp.referencesAggregation,
      targetProp: def.target.propDef?.prop || 0,
    })
  } else {
    const queryType = isRootCountOnly(def, filterSize)
      ? QueryType.aggregatesCount
      : QueryType.aggregates

    headerBuffer = createAggHeader({
      ...commonHeader,
      op: queryType,
      typeId: def.schema.id,
      limit: def.range.limit,
      iteratorType: getIteratorType(def, hasFilter),
    })
  }

  const headerSize = headerBuffer.length
  const totalSize =
    headerSize +
    filterSize +
    numPropsOrFuncs * AggPropByteSize +
    groupByKeyPropByteSize
  const buffer = new Uint8Array(totalSize)

  let pos = 0

  buffer.set(headerBuffer, pos)
  pos += headerSize

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

  return buffer
}
