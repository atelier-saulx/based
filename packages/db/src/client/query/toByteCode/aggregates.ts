import { filterToBuffer } from '../query.js'
import {
  QueryDef,
  QueryDefType,
  QueryType,
  includeOp,
  IntermediateByteCode,
  type QueryDefAggregation,
} from '../types.js'
import {
  aggregateToBuffer,
  isRootCountOnly,
} from '../aggregates/aggregation.js'
import { writeUint16 } from '@based/utils'

export const aggregatesQuery = (def: QueryDef): IntermediateByteCode => {
  const aggregate = def.aggregate as QueryDefAggregation
  const aggregateSize = aggregate.size || 0
  if (aggregateSize === 0) {
    throw new Error('Wrong aggregate size (0)')
  }
  const filterSize = def.filter.size || 0

  if (def.type === QueryDefType.References) {
    const buf = new Uint8Array(12 + filterSize + aggregateSize) // op + refSize + filterSize + offset + typeId + refField
    const sz = 9 + filterSize + aggregateSize // filterSize + offset + typeId + refField

    buf[0] = includeOp.REFS_AGGREGATION
    buf[1] = sz
    buf[2] = sz >>> 8
    buf[3] = filterSize
    buf[4] = filterSize >>> 8
    buf[5] = def.range.offset
    buf[6] = def.range.offset >>> 8
    buf[7] = def.range.offset >>> 16
    buf[8] = def.range.offset >>> 24

    if (filterSize) {
      buf.set(filterToBuffer(def.filter, 9), 9)
    }

    // required to get typeEntry and fieldSchema
    writeUint16(buf, def.schema.id, 9 + filterSize)

    // buf[9 + filterSize] = def.schema.idUint8[0] // typeId
    // buf[9 + 1 + filterSize] = def.schema.idUint8[1] // typeId
    buf[9 + 2 + filterSize] = def.target.propDef?.id ?? 0 // refField
    const aggregateBuffer = aggregateToBuffer(aggregate)
    buf.set(aggregateBuffer, 9 + 3 + filterSize)
    return { buffer: buf, def, needsMetaResolve: def.filter.hasSubMeta }
  } else {
    const buf = new Uint8Array(16 + filterSize + aggregateSize)
    buf[0] = isRootCountOnly(def, filterSize)
      ? QueryType.aggregatesCountType
      : QueryType.aggregates

    writeUint16(buf, def.schema.id, 1)
    // buf[1] = def.schema.idUint8[0]
    // buf[2] = def.schema.idUint8[1]
    buf[3] = def.range.offset
    buf[4] = def.range.offset >>> 8
    buf[5] = def.range.offset >>> 16
    buf[6] = def.range.offset >>> 24
    buf[7] = def.range.limit
    buf[8] = def.range.limit >>> 8
    buf[9] = def.range.limit >>> 16
    buf[10] = def.range.limit >>> 24
    buf[11] = filterSize
    buf[12] = filterSize >>> 8
    if (filterSize) {
      buf.set(filterToBuffer(def.filter, 13), 13)
    }
    const aggregateBuffer = aggregateToBuffer(aggregate)
    buf[14 + filterSize] = aggregateSize
    buf[15 + filterSize] = aggregateSize >>> 8
    buf.set(aggregateBuffer, 16 + filterSize)
    return { buffer: buf, def, needsMetaResolve: def.filter.hasSubMeta }
  }
}
