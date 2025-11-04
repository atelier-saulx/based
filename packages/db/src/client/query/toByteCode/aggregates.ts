import { filterToBuffer } from '../query.js'
import { QueryDef, QueryDefType, QueryType, includeOp } from '../types.js'
import {
  aggregateToBuffer,
  isRootCountOnly,
} from '../aggregates/aggregation.js'
import { writeUint16, writeUint32 } from '@based/utils'
import { REFERENCES_AGGREGATION, AGGREGATES } from './offsets.js'

export const aggregatesQuery = (def: QueryDef) => {
  const filterSize = def.filter.size || 0
  const aggregateSize = def.aggregate.size || 0
  if (aggregateSize === 0) {
    throw new Error('Wrong aggregate size (0)')
  }

  if (def.type === QueryDefType.References) {
    const buf = new Uint8Array(
      REFERENCES_AGGREGATION.baseSize + filterSize + aggregateSize,
    )
    const sz = 10 + filterSize + aggregateSize

    buf[REFERENCES_AGGREGATION.includeOp] = includeOp.REFERENCES_AGGREGATION
    writeUint16(buf, sz, REFERENCES_AGGREGATION.size)
    writeUint16(buf, filterSize, REFERENCES_AGGREGATION.filterSize)
    writeUint32(buf, def.range.offset, REFERENCES_AGGREGATION.offset)

    if (filterSize) {
      buf.set(filterToBuffer(def.filter), REFERENCES_AGGREGATION.filter)
    }

    // required to get typeEntry and fieldSchema
    writeUint16(buf, def.schema.id, REFERENCES_AGGREGATION.typeId + filterSize)
    buf[REFERENCES_AGGREGATION.prop + filterSize] = (
      def.target as any
    ).propDef.prop
    const aggregateBuffer = aggregateToBuffer(def.aggregate)
    buf.set(
      aggregateBuffer,
      REFERENCES_AGGREGATION.aggregateBuffer + filterSize,
    )

    return buf
  }

  const buf = new Uint8Array(AGGREGATES.baseSize + filterSize + aggregateSize)
  buf[AGGREGATES.queryType] = isRootCountOnly(def, filterSize)
    ? QueryType.aggregatesCountType
    : QueryType.aggregates
  writeUint16(buf, def.schema.id, AGGREGATES.type)
  writeUint32(buf, def.range.offset, AGGREGATES.offset)
  writeUint32(buf, def.range.limit, AGGREGATES.limit)
  writeUint16(buf, filterSize, AGGREGATES.filterSize)
  if (filterSize) {
    buf.set(filterToBuffer(def.filter), AGGREGATES.filter)
  }
  const aggregateBuffer = aggregateToBuffer(def.aggregate)
  writeUint16(buf, aggregateSize, AGGREGATES.aggregateSize + filterSize)
  buf.set(aggregateBuffer, AGGREGATES.aggregateBuffer + filterSize)
  return buf
}
