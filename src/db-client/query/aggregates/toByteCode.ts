import { filterToBuffer } from '../query.js'
import {
  QueryDef,
  QueryType,
  IntermediateByteCode,
  QueryDefAggregate,
} from '../types.js'
import { isRootCountOnly } from '../aggregates/aggregation.js'
import {
  type QueryDefAggregateHeader,
  createQueryDefAggregateHeader,
  AggregateFunction,
  AggregateProp,
  SamplingMode,
} from '../../../zigTsExports.js'

export const aggregateToBuffer = (def: QueryDef): IntermediateByteCode => {
  if (def.schema == null) {
    throw new Error('Wrong schema definition.')
  }
  if (def.aggregate == null || def.aggregate?.size == 0) {
    throw new Error('Wrong aggregate definition.')
  }

  const filterSize = def.filter.size || 0
  const buf = new Uint8Array(16 + def.filter.size + def.aggregate.size)
  const queryType = isRootCountOnly(def, filterSize)
    ? QueryType.aggregatesCountType
    : QueryType.aggregates

  let queryDefAggregateHeader: QueryDefAggregateHeader = {
    queryType,
    typeId: def.schema.id,
    offset: def.range.offset,
    limit: def.range.limit,
    filterSize,
  }
  let queryDefAggregate: Omit<QueryDefAggregate, 'aggregates'> = {
    ...queryDefAggregateHeader,
    size: def.aggregate.size,
    totalResultsSize: def.aggregate.totalResultsSize,
    totalAccumulatorSize: def.aggregate.totalAccumulatorSize,
  }

  // início de antigo aggregateBuffer
  for (const [aggFunc, aggPropsArray] of def.aggregate.aggregates.entries()) {
    const aggFunction: AggregateFunction = {
      start: aggFunc.start,
      type = aggFunc.type,
      samplingMode: aggFunc.samplingMode,
    }
    let size = 0
    for (const agg of aggregatesArray) {
      const aggProp: AggregateProp = {
        propId: prop,
        propType: agg.type,
        start: agg.propDef.start!,
        accumulatorPos: 0,
        isEdge: typeof agg.propDef.__isEdge !== 'undefined',
      }
    }
    // queryDefAggregate.size = size
    // aggFunction.accumulatorPos = aggFunction.accumulatorPos
  }

  //   buf.set(aggregateBuffer, 16 + filterSize)
  return { buffer: buf, def, needsMetaResolve: def.filter.hasSubMeta }
}
