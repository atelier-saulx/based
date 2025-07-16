import { writeUint16 } from '@saulx/utils'
import { QueryDefAggregation } from '../types.js'
import { GroupBy } from './types.js'

export const aggregateToBuffer = (
  aggregates: QueryDefAggregation,
): Uint8Array => {
  const aggBuffer = new Uint8Array(aggregates.size)
  let i = 0
  if (aggregates.groupBy) {
    aggBuffer[i] = GroupBy.HAS_GROUP
    i += 1
    aggBuffer[i] = aggregates.groupBy.prop
    i += 1
    aggBuffer[i] = aggregates.groupBy.typeIndex
    i += 1
    writeUint16(aggBuffer, aggregates.groupBy.start, i)
    i += 2
    writeUint16(aggBuffer, aggregates.groupBy.len, i)
    i += 2
  } else {
    aggBuffer[i] = GroupBy.NONE
    i += 1
  }
  writeUint16(aggBuffer, aggregates.totalResultsSize, i)
  i += 2
  writeUint16(aggBuffer, aggregates.totalAccumulatorSize, i)
  i += 2
  for (const [prop, aggregatesArray] of aggregates.aggregates.entries()) {
    aggBuffer[i] = prop
    i += 1
    let sizeIndex = i
    let size = 0
    i += 2
    for (const agg of aggregatesArray) {
      let startI = i
      aggBuffer[i] = agg.type
      i += 1
      aggBuffer[i] = agg.propDef.typeIndex
      i += 1
      writeUint16(aggBuffer, agg.propDef.start, i)
      i += 2
      writeUint16(aggBuffer, agg.resultPos, i)
      i += 2
      writeUint16(aggBuffer, agg.accumulatorPos, i)
      i += 2
      size += i - startI
    }
    writeUint16(aggBuffer, size, sizeIndex)
  }
  return aggBuffer
}
