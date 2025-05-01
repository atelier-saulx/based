import { writeUint16 } from '@saulx/utils'
import { QueryDef, QueryDefAggregation } from '../types.js'
import { AggregateType, GroupBy } from './types.js'

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
  } else {
    aggBuffer[i] = GroupBy.NONE
    i += 1
  }

  writeUint16(aggBuffer, aggregates.totalResultsPos, i)
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
      size += i - startI
    }
    writeUint16(aggBuffer, size, sizeIndex)
  }

  return aggBuffer
}

const ensureAggregate = (def: QueryDef) => {
  if (!def.aggregate) {
    def.aggregate = {
      size: 3,
      aggregates: new Map(),
      totalResultsPos: 0,
    }
  }
}

// Group by is great for normal stuff as well (do later)
export const groupBy = (def: QueryDef, field: string) => {
  console.log(field)
  const fieldDef = def.schema.props[field]
  if (!fieldDef) {
    throw new Error(
      `Field for agg:groupBy does not exists ${field} make better error later...`,
    )
  }
  ensureAggregate(def)
  if (!def.aggregate.groupBy) {
    def.aggregate.size += 5
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
      const fieldDef = def.schema.props[field]
      if (!fieldDef) {
        throw new Error(
          `Field for agg does not exists ${field} make better error later...`,
        )
      }
      if (!aggregates.get(fieldDef.prop)) {
        aggregates.set(fieldDef.prop, [])
        def.aggregate.size += 3
      }
      const aggregateField = aggregates.get(fieldDef.prop)
      aggregateField.push({
        propDef: fieldDef,
        type,
        resultPos: def.aggregate.totalResultsPos,
      })
      // IF FLOAT // NUMBER ETC USE 8!
      // do this better
      def.aggregate.totalResultsPos += 4
      // needs to add an extra field WRITE TO
      def.aggregate.size += 6
    }
  }
}
