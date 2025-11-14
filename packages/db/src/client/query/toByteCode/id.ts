import { filterToBuffer } from '../query.ts'
import { QueryDef, QueryType, IntermediateByteCode } from '../types.ts'
import { writeUint16, writeUint32 } from '@based/utils'
import { ID } from './offsets.ts'

export const idQuery = (def: QueryDef): IntermediateByteCode => {
  const filterSize = def.filter.size || 0
  const buffer = new Uint8Array(ID.baseSize + filterSize)
  buffer[ID.queryType] = QueryType.id
  writeUint16(buffer, def.schema.id, ID.type)
  writeUint32(buffer, (def.target as any).id, ID.id)
  writeUint16(buffer, filterSize, ID.filterSize)
  if (filterSize) {
    buffer.set(filterToBuffer(def.filter, ID.filter), ID.filter)
  }
  return { buffer, def, needsMetaResolve: def.filter.hasSubMeta }
}
