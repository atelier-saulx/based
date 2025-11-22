import { numberTypes, typeIndexMap, type TypeIndex } from '@based/schema'
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
    case typeIndexMap.number:
      return readDoubleLE(value, offset)
    case typeIndexMap.uint16:
      return readUint16(value, offset)
    case typeIndexMap.uint32:
      return readUint32(value, offset)
    case typeIndexMap.int16:
      return readInt16(value, offset)
    case typeIndexMap.int32:
      return readInt32(value, offset)
    case typeIndexMap.uint8:
      return value[offset]
    case typeIndexMap.int8:
      return value[offset]
  }
}

const numberTypeIndexSet = new Set<TypeIndex>(
  numberTypes.map((type) => typeIndexMap[type]),
)

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
        if (q.aggregate.groupBy.typeIndex == typeIndexMap.enum) {
          i += 2
          key = q.aggregate.groupBy.enum[result[i] - 1]
          i++
        } else if (numberTypeIndexSet.has(q.aggregate.groupBy.typeIndex)) {
          keyLen = readUint16(result, i)
          i += 2
          key = readNumber(result, i, q.aggregate.groupBy.typeIndex)
          i += keyLen
        } else if (
          q.aggregate.groupBy.typeIndex == typeIndexMap.timestamp &&
          q.aggregate.groupBy.stepType
        ) {
          keyLen = readUint16(result, i)
          i += 2
          key = readNumber(result, i, typeIndexMap.int32)
          i += keyLen
        } else if (
          q.aggregate.groupBy.typeIndex == typeIndexMap.timestamp &&
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
        } else if (q.aggregate.groupBy.typeIndex == typeIndexMap.reference) {
          keyLen = readUint16(result, i)
          i += 2
          key = readNumber(result, i, typeIndexMap.int32)
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
        if (agg.type === AggregateType.COUNT) {
          setByPath(resultKey, agg.path, val)
        } else {
          setByPath(
            resultKey,
            [...agg.path, AggregateType[agg.type].toLowerCase()],
            val,
          )
        }
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
      if (agg.type === AggregateType.COUNT) {
        setByPath(results, agg.path, val)
      } else if (agg.path.length > 1 && agg.path[1][0] == '$') {
        // MV: make it better
        setByPath(
          results,
          [agg.path[1], AggregateType[agg.type].toLowerCase()],
          val,
        )
      } else {
        setByPath(
          results,
          [...agg.path, AggregateType[agg.type].toLowerCase()],
          val,
        )
      }
    }
  }
  return results
}
