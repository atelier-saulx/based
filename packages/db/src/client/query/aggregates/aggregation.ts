import { writeUint16 } from '@based/utils'
import { QueryDef, QueryDefAggregation, QueryDefType } from '../types.js'
import { AggregateType, GroupBy } from './types.js'
import { PropDef, UINT32 } from '@based/schema/def'
import { aggregationFieldDoesNotExist } from '../validation.js'
import { aggregateTypeMap } from '../aggregates/types.js'

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

const ensureAggregate = (def: QueryDef) => {
  if (!def.aggregate) {
    def.aggregate = {
      size: 5,
      aggregates: new Map(),
      totalResultsSize: 0,
      totalAccumulatorSize: 0,
    }
  }
}

export const groupBy = (def: QueryDef, field: string) => {
  const fieldDef = def.schema.props[field]
  if (!fieldDef) {
    aggregationFieldDoesNotExist(def, field)
  }
  ensureAggregate(def)
  if (!def.aggregate.groupBy) {
    def.aggregate.size += 6
  }
  def.aggregate.groupBy = fieldDef
}

export const addAggregate = (
  type: AggregateType,
  def: QueryDef,
  fields: (string | string[])[],
) => {
  ensureAggregate(def)
  const aggregates = def.aggregate.aggregates
  for (const field of fields) {
    if (Array.isArray(field)) {
      addAggregate(type, def, field)
    } else {
      const fieldDef: PropDef =
        type === AggregateType.COUNT
          ? {
              prop: 255,
              path: [field],
              __isPropDef: true,
              len: 4,
              start: 0,
              typeIndex: UINT32,
              separate: true,
              validation: () => true,
              default: 0,
            }
          : def.schema.props[field]

      if (!fieldDef) {
        aggregationFieldDoesNotExist(def, field)
      }

      if (!aggregates.get(fieldDef.prop)) {
        aggregates.set(fieldDef.prop, [])
        def.aggregate.size += 3
      }

      const aggregateField = aggregates.get(fieldDef.prop)
      aggregateField.push({
        propDef: fieldDef,
        type,
        resultPos: def.aggregate.totalResultsSize,
        accumulatorPos: def.aggregate.totalAccumulatorSize,
      })

      const specificSizes = aggregateTypeMap.get(type)
      if (specificSizes) {
        def.aggregate.totalResultsSize += specificSizes.resultsSize
        def.aggregate.totalAccumulatorSize += specificSizes.accumulatorSize
      } else {
        def.aggregate.totalResultsSize += 8
        def.aggregate.totalAccumulatorSize += 8
      }
      // needs to add an extra field WRITE TO
      def.aggregate.size += 8
    }
  }
}

export const isRootCountOnly = (def: QueryDef, filterSize: number) => {
  if (filterSize != 0) {
    return false
  }
  if (def.type !== QueryDefType.Root) {
    return false
  }
  if (def.aggregate.groupBy) {
    return false
  }
  if (def.aggregate.aggregates.size !== 1) {
    return false
  }
  if (!def.aggregate.aggregates.has(255)) {
    return false
  }
  const aggs = def.aggregate.aggregates.get(255)
  if (aggs.length !== 1) {
    return false
  }
  if (aggs[0].type !== AggregateType.COUNT) {
    return false
  }
  if (def.filter && def.filter.size > 0) {
    return false
  }
  return true
}
