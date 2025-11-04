import { filterToBuffer } from '../query.js'
import { QueryDef, QueryDefType, QueryType, includeOp } from '../types.js'
import {
  aggregateToBuffer,
  isRootCountOnly,
} from '../aggregates/aggregation.js'
import { writeUint16, writeUint32 } from '@based/utils'
import { AGGREGATES, REFERENCES_AGGREGATION } from './constants.js'

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

    let index = REFERENCES_AGGREGATION.filter
    if (filterSize) {
      buf.set(filterToBuffer(def.filter), index)
      index += filterSize
    }

    // required to get typeEntry and fieldSchema
    writeUint16(buf, def.schema.id, index) // typeId
    buf[index + 2] = (def.target as any).propDef.prop // refField
    const aggregateBuffer = aggregateToBuffer(def.aggregate)
    buf.set(aggregateBuffer, index + 3)

    return buf
  } else {
    const buf = new Uint8Array(
      AGGREGATES.baseSize + filterSize + aggregateSize,
    )

    buf[AGGREGATES.queryType] = isRootCountOnly(def, filterSize)
      ? QueryType.aggregatesCountType
      : QueryType.aggregates
    writeUint16(buf, def.schema.id, AGGREGATES.type)
    writeUint32(buf, def.range.offset, AGGREGATES.offset)
    writeUint32(buf, def.range.limit, AGGREGATES.limit)
    writeUint16(buf, filterSize, AGGREGATES.filterSize)

    let index = AGGREGATES.filter
    if (filterSize) {
      buf.set(filterToBuffer(def.filter), index)
      index += filterSize
    }

    const aggregateBuffer = aggregateToBuffer(def.aggregate)
    writeUint16(buf, aggregateSize, index)
    buf.set(aggregateBuffer, index + 2)

    return buf
  }
}
