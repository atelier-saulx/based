import { ReaderSchema, ReaderGroupBy, ReaderAggregates } from './types.js'
import {
  PropType,
  type PropTypeEnum,
  AggFunction,
  AggFunctionInverse,
} from '../../zigTsExports.js'
import {
  DECODER,
  readDoubleLE,
  readInt16,
  readInt32,
  readInt64,
  readUint16,
  readUint32,
  setByPath,
} from '../../utils/index.js'

const isNumberType = (type: PropTypeEnum): boolean => {
  return (
    type === PropType.number ||
    type === PropType.uint16 ||
    type === PropType.uint32 ||
    type === PropType.int16 ||
    type === PropType.int32 ||
    type == PropType.uint8 ||
    type === PropType.int8 ||
    type === PropType.cardinality
  )
}

const readNumber = (
  value: Uint8Array,
  offset: number,
  type: PropTypeEnum,
): any => {
  switch (type) {
    case PropType.number:
      return readDoubleLE(value, offset)
    case PropType.uint16:
      return readUint16(value, offset)
    case PropType.uint32:
      return readUint32(value, offset)
    case PropType.int16:
      return readInt16(value, offset)
    case PropType.int32:
      return readInt32(value, offset)
    case PropType.uint8:
      return value[offset]
    case PropType.int8:
      return value[offset]
  }
}

export const readAggregate = (
  q: ReaderSchema,
  result: Uint8Array,
  offset: number,
  len: number,
) => {
  const { groupBy, aggregates, totalResultsSize } = q.aggregate!
  const results = {}

  if (groupBy) {
    let cursor = offset
    while (cursor < len) {
      const { key, bytesRead } = readGroupKey(result, cursor, groupBy)
      cursor += bytesRead
      results[key] = results[key] || {}
      readAggValues(result, cursor, aggregates, results[key])
      cursor += totalResultsSize
    }
  } else {
    readAggValues(result, offset, aggregates, results)
  }

  return results
}

const readGroupKey = (
  result: Uint8Array,
  offset: number,
  groupBy: ReaderGroupBy,
): { key: string | number; bytesRead: number } => {
  if (result[offset] === 0) {
    return { key: '$undefined', bytesRead: 0 }
  }

  if (groupBy.typeIndex === PropType.enum) {
    const enumIndex = result[offset + 2] - 1
    return {
      key: groupBy.enum![enumIndex],
      bytesRead: 3,
    }
  }

  const len = readUint16(result, offset)
  const contentOffset = offset + 2

  let key: string | number

  if (isNumberType(groupBy.typeIndex)) {
    key = readNumber(result, contentOffset, groupBy.typeIndex)
  } else if (groupBy.typeIndex === PropType.reference) {
    key = readNumber(result, contentOffset, PropType.int32)
  } else if (groupBy.typeIndex === PropType.timestamp) {
    const tsValue = readInt64(result, contentOffset)
    if (groupBy.stepType) {
      // MV: to check, it is a reread
      key = readNumber(result, contentOffset, PropType.int32)
    }
    // MV: to review
    else {
      const { display, stepRange } = groupBy
      if (!display) {
        key = tsValue.toString()
      } else if (stepRange && stepRange > 0) {
        key = display.formatRange(tsValue, tsValue + stepRange * 1000)
      } else {
        key = display.format(tsValue)
      }
    }
  } else {
    key = DECODER.decode(result.subarray(contentOffset, contentOffset + len))
  }

  return { key, bytesRead: 2 + len }
}

const readAggValues = (
  result: Uint8Array,
  baseOffset: number,
  aggregates: ReaderAggregates[],
  targetObject: any,
) => {
  for (const agg of aggregates) {
    const isCountOrCardinality =
      agg.type === AggFunction.cardinality || agg.type === AggFunction.count
    const readFn = isCountOrCardinality ? readUint32 : readDoubleLE

    const val = readFn(result, baseOffset + agg.resultPos)

    const pathSuffix =
      agg.type === AggFunction.count ? [] : [AggFunctionInverse[agg.type]]

    // MV: check for edgesagg.path[1][0] == '$`
    setByPath(targetObject, [...agg.path, ...pathSuffix], val)
  }
}
