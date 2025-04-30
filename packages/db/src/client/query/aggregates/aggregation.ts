import { writeUint16, writeUint32 } from '@saulx/utils'
import { AggregateType, QueryDef, QueryDefAggregation } from '../types.js'
import {
  PropDef,
  PropDefEdge,
  REFERENCE,
  REFERENCES,
  isNumberType,
} from '@based/schema/def'

export const aggregateToBuffer = (
  aggregates: QueryDefAggregation,
): Uint8Array => {
  const aggBuffer = new Uint8Array(aggregates.size)
  writeUint16(aggBuffer, aggregates.totalResultsPos, 0)

  let i = 2
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
      aggBuffer[i] = agg.propDef.start
      aggBuffer[i + 1] = agg.propDef.start >>> 8
      i += 2

      // for now just start here BUT will need to add the previous last start for non main fields!
      aggBuffer[i] = agg.resultPos
      aggBuffer[i + 1] = agg.resultPos >>> 8
      i += 2

      size += i - startI
    }

    aggBuffer[sizeIndex] = size
    aggBuffer[sizeIndex + 1] = size >>> 8
  }

  return aggBuffer
}

export const sum = (def: QueryDef, fields: (string | string[])[]) => {
  if (!def.aggregate) {
    def.aggregate = {
      size: 2,
      aggregates: new Map(),
      totalResultsPos: 0,
    }
  }
  const aggregates = def.aggregate.aggregates
  for (const field of fields) {
    if (Array.isArray(field)) {
      sum(def, field)
    } else {
      const fieldDef = def.schema.props[field]
      if (!aggregates.get(fieldDef.prop)) {
        aggregates.set(fieldDef.prop, [])
        def.aggregate.size += 3
      }
      const aggregateField = aggregates.get(fieldDef.prop)
      aggregateField.push({
        propDef: fieldDef,
        type: AggregateType.SUM,
        resultPos: def.aggregate.totalResultsPos,
      })
      // do this better
      def.aggregate.totalResultsPos += 4
      // needs to add an extra field WRITE TO
      def.aggregate.size += 6
    }
  }
}
