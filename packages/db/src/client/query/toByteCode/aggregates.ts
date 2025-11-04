import { filterToBuffer } from '../query.js'
import { QueryDef, QueryDefType, QueryType, includeOp } from '../types.js'
import {
  aggregateToBuffer,
  isRootCountOnly,
} from '../aggregates/aggregation.js'
import { writeUint16, writeUint32 } from '@based/utils'

export const aggregatesQuery = (def: QueryDef) => {
  const filterSize = def.filter.size || 0
  const aggregateSize = def.aggregate.size || 0
  if (aggregateSize === 0) {
    throw new Error('Wrong aggregate size (0)')
  }

  if (def.type === QueryDefType.References) {
    const buf = new Uint8Array(13 + filterSize + aggregateSize)
    const sz = 10 + filterSize + aggregateSize

    buf[0] = includeOp.REFERENCES_AGGREGATION
    writeUint16(buf, sz, 1)
    writeUint16(buf, filterSize, 3)
    writeUint32(buf, def.range.offset, 5)

    if (filterSize) {
      buf.set(filterToBuffer(def.filter), 9)
    }

    // required to get typeEntry and fieldSchema
    writeUint16(buf, def.schema.id, 9 + filterSize)
    buf[9 + 2 + filterSize] = (def.target as any).propDef.prop
    const aggregateBuffer = aggregateToBuffer(def.aggregate)
    buf.set(aggregateBuffer, 9 + 3 + filterSize)

    return buf
  }

  const buf = new Uint8Array(16 + filterSize + aggregateSize)
  buf[0] = isRootCountOnly(def, filterSize)
    ? QueryType.aggregatesCountType
    : QueryType.aggregates
  writeUint16(buf, def.schema.id, 1)
  writeUint32(buf, def.range.offset, 3)
  writeUint32(buf, def.range.limit, 7)
  writeUint16(buf, filterSize, 11)
  if (filterSize) {
    buf.set(filterToBuffer(def.filter), 13)
  }
  const aggregateBuffer = aggregateToBuffer(def.aggregate)
  writeUint16(buf, aggregateSize, 14 + filterSize)
  buf.set(aggregateBuffer, 16 + filterSize)
  return buf
}
