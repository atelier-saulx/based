import { filterToBuffer } from '../query.js'
import {
  QueryDef,
  QueryDefType,
  QueryType,
  includeOp,
  IntermediateByteCode,
} from '../types.js'
import {
  aggregateToBuffer,
  isRootCountOnly,
} from '../aggregates/aggregation.js'
import { writeUint16, writeUint32 } from '@based/utils'
import { REFS_AGGREGATION, AGGREGATES } from './offsets.js'

export const aggregatesQuery = (def: QueryDef): IntermediateByteCode => {
  const filterSize = def.filter.size || 0
  const aggregateSize = def.aggregate.size || 0
  if (aggregateSize === 0) {
    throw new Error('Wrong aggregate size (0)')
  }

  if (def.type === QueryDefType.References) {
    const buffer = new Uint8Array(
      REFS_AGGREGATION.baseSize + filterSize + aggregateSize,
    )
    const sz = 10 + filterSize + aggregateSize

    buffer[REFS_AGGREGATION.includeOp] = includeOp.REFS_AGGREGATION
    writeUint16(buffer, sz, REFS_AGGREGATION.size)
    writeUint16(buffer, filterSize, REFS_AGGREGATION.filterSize)
    writeUint32(buffer, def.range.offset, REFS_AGGREGATION.offset)

    if (filterSize) {
      buffer.set(
        filterToBuffer(def.filter, REFS_AGGREGATION.filter),
        REFS_AGGREGATION.filter,
      )
    }

    // required to get typeEntry and fieldSchema
    writeUint16(buffer, def.schema.id, REFS_AGGREGATION.typeId + filterSize)
    buffer[REFS_AGGREGATION.prop + filterSize] = (
      def.target as any
    ).propDef.prop
    const aggregateBuffer = aggregateToBuffer(def.aggregate)
    buffer.set(aggregateBuffer, REFS_AGGREGATION.aggregateBuffer + filterSize)
    return { buffer, def }
  }

  const buffer = new Uint8Array(
    AGGREGATES.baseSize + filterSize + aggregateSize,
  )
  buffer[AGGREGATES.queryType] = isRootCountOnly(def, filterSize)
    ? QueryType.aggregatesCountType
    : QueryType.aggregates
  writeUint16(buffer, def.schema.id, AGGREGATES.type)
  writeUint32(buffer, def.range.offset, AGGREGATES.offset)
  writeUint32(buffer, def.range.limit, AGGREGATES.limit)
  writeUint16(buffer, filterSize, AGGREGATES.filterSize)
  if (filterSize) {
    buffer.set(filterToBuffer(def.filter, AGGREGATES.filter), AGGREGATES.filter)
  }
  const aggregateBuffer = aggregateToBuffer(def.aggregate)
  writeUint16(buffer, aggregateSize, AGGREGATES.aggregateSize + filterSize)
  buffer.set(aggregateBuffer, AGGREGATES.aggregateBuffer + filterSize)
  return { buffer, def, needsMetaResolve: def.filter.hasSubMeta }
}
