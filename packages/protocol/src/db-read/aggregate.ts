import {
  ENUM,
  isNumberType,
  TIMESTAMP,
  REFERENCE,
  INT16,
  INT32,
  INT8,
  NUMBER,
  UINT16,
  UINT32,
  UINT8,
  TypeIndex,
} from '@based/schema/prop-types'
import { ReaderSchema, AggregateType } from './types.js'
import {
  readInt64,
  readUint16,
  readDoubleLE,
  readUint32,
  readInt16,
  readInt32,
} from '@based/utils'
import { setByPath, DECODER } from '@based/utils'

const readNumber = (
  value: Uint8Array,
  offset: number,
  type: TypeIndex,
): any => {
  switch (type) {
    case NUMBER:
      return readDoubleLE(value, offset)
    case UINT16:
      return readUint16(value, offset)
    case UINT32:
      return readUint32(value, offset)
    case INT16:
      return readInt16(value, offset)
    case INT32:
      return readInt32(value, offset)
    case UINT8:
      return value[offset]
    case INT8:
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
  if (q.aggregate.groupBy) {
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
        if (q.aggregate.groupBy.typeIndex == ENUM) {
          i += 2
          key = q.aggregate.groupBy.enum[result[i] - 1]
          i++
        } else if (isNumberType(q.aggregate.groupBy.typeIndex)) {
          keyLen = readUint16(result, i)
          i += 2
          key = readNumber(result, i, q.aggregate.groupBy.typeIndex)
          i += keyLen
        } else if (
          q.aggregate.groupBy.typeIndex == TIMESTAMP &&
          q.aggregate.groupBy.stepType
        ) {
          keyLen = readUint16(result, i)
          i += 2
          key = readNumber(result, i, INT32)
          i += keyLen
        } else if (
          q.aggregate.groupBy.typeIndex == TIMESTAMP &&
          q.aggregate.groupBy.stepRange !== 0
        ) {
          keyLen = readUint16(result, i)
          i += 2
          if (!q.aggregate?.groupBy?.display) {
            key = readInt64(result, i).toString()
          } else if (q.aggregate?.groupBy?.stepRange > 0) {
            const dtFormat = q.aggregate?.groupBy.display
            let v = readInt64(result, i)
            key = dtFormat.formatRange(
              v,
              v + q.aggregate?.groupBy.stepRange * 1000,
            )
          } else {
            const dtFormat = q.aggregate?.groupBy.display
            key = dtFormat.format(readInt64(result, i))
          }
          i += keyLen
        } else if (q.aggregate.groupBy.typeIndex == REFERENCE) {
          keyLen = readUint16(result, i)
          i += 2
          key = readNumber(result, i, INT32)
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
        var val = undefined
        if (
          agg.type === AggregateType.CARDINALITY ||
          agg.type === AggregateType.COUNT
        ) {
          val = readUint32(result, agg.resultPos + i)
        } else {
          val = readDoubleLE(result, agg.resultPos + i)
        }
        setByPath(
          resultKey,
          [...agg.path, AggregateType[agg.type].toLowerCase()],
          val,
        )
      }
      i += q.aggregate.totalResultsSize
    }
  } else {
    for (const agg of q.aggregate.aggregates) {
      var val = undefined
      if (
        agg.type === AggregateType.CARDINALITY ||
        agg.type === AggregateType.COUNT
      ) {
        val = readUint32(result, agg.resultPos + offset)
      } else {
        val = readDoubleLE(result, agg.resultPos + offset)
      }
      setByPath(
        results,
        [...agg.path, AggregateType[agg.type].toLowerCase()],
        val,
      )
    }
  }
  return results
}
