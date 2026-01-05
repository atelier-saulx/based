import { ReaderSchema } from './types.js'
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
  // only need agg
  q: ReaderSchema,
  result: Uint8Array,
  offset: number,
  len: number,
) => {
  const results = {}
  if (q.aggregate?.groupBy) {
    let i = offset
    while (i < len) {
      let key: string = ''
      let keyLen: number = 0
      if (result[i] == 0) {
        // tmp this is rly nice to have...
        // if (q.aggregate.groupBy.default) {
        //   key = q.aggregate.groupBy.default
        // } else {
        key = `$undefined`
        // }
        i += 2
      } else {
        if (q.aggregate.groupBy.typeIndex == PropType.enum) {
          i += 2
          key = q.aggregate.groupBy.enum![result[i] - 1]
          i++
        } else if (isNumberType(q.aggregate.groupBy.typeIndex)) {
          keyLen = readUint16(result, i)
          i += 2
          key = readNumber(result, i, q.aggregate.groupBy.typeIndex)
          i += keyLen
        } else if (
          q.aggregate.groupBy.typeIndex == PropType.timestamp &&
          q.aggregate.groupBy.stepType
        ) {
          keyLen = readUint16(result, i)
          i += 2
          key = readNumber(result, i, PropType.int32)
          i += keyLen
        } else if (
          q.aggregate.groupBy.typeIndex == PropType.timestamp &&
          q.aggregate.groupBy.stepRange !== 0
        ) {
          keyLen = readUint16(result, i)
          i += 2
          if (!q.aggregate?.groupBy?.display) {
            key = readInt64(result, i).toString()
          } else if (q.aggregate?.groupBy?.stepRange! > 0) {
            const dtFormat = q.aggregate.groupBy.display
            let v = readInt64(result, i)
            key = dtFormat.formatRange(
              v,
              v + q.aggregate.groupBy.stepRange! * 1000,
            )
          } else {
            const dtFormat = q.aggregate?.groupBy.display
            key = dtFormat.format(readInt64(result, i))
          }
          i += keyLen
        } else if (q.aggregate.groupBy.typeIndex == PropType.reference) {
          keyLen = readUint16(result, i)
          i += 2
          key = readNumber(result, i, PropType.int32)
          i += keyLen
        } else {
          keyLen = readUint16(result, i)
          i += 2
          key = DECODER.decode(result.subarray(i, i + keyLen))
          i += keyLen
        }
      }
      const resultKey = (results[key] = {})
      for (const agg of q.aggregate.aggregates) {
        var val: number
        if (
          agg.type == AggFunction.cardinality ||
          agg.type === AggFunction.count
        ) {
          val = readUint32(result, agg.resultPos + i)
        } else {
          val = readDoubleLE(result, agg.resultPos + i)
        }
        if (agg.type === AggFunction.count) {
          setByPath(resultKey, agg.path, val)
        } else {
          setByPath(resultKey, [...agg.path, AggFunction[agg.type]], val)
        }
      }
      i += q.aggregate.totalResultsSize
    }
  } else {
    for (const agg of q.aggregate!.aggregates) {
      var val: number
      if (
        agg.type === AggFunction.cardinality ||
        agg.type === AggFunction.count
      ) {
        val = readUint32(result, agg.resultPos + offset)
      } else {
        val = readDoubleLE(result, agg.resultPos + offset)
      }
      if (agg.type === AggFunction.count) {
        setByPath(results, agg.path, val)
      } else if (agg.path.length > 1 && agg.path[1][0] == '$') {
        // MV: make it better
        setByPath(results, [agg.path[1], AggFunctionInverse[agg.type]], val)
      } else {
        setByPath(results, [...agg.path, AggFunctionInverse[agg.type]], val)
      }
    }
  }
  return results
}
