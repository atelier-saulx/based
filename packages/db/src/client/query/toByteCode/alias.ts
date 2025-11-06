import { filterToBuffer } from '../query.js'
import { QueryDef, QueryType, IntermediateByteCode } from '../types.js'
import { ENCODER, writeUint16 } from '@based/utils'
import { ALIAS } from './offsets.js'

export const aliasQuery = (def: QueryDef): IntermediateByteCode => {
  const filterSize = def.filter.size || 0
  const alias = (def.target as any).resolvedAlias
  const aliasStr = ENCODER.encode(alias.value)
  const aliasLen = aliasStr.byteLength
  const buffer = new Uint8Array(ALIAS.baseSize + filterSize + aliasLen)
  buffer[ALIAS.queryType] = QueryType.alias
  writeUint16(buffer, def.schema.id, ALIAS.type)
  buffer[ALIAS.prop] = alias.def.prop
  writeUint16(buffer, aliasLen, ALIAS.aliasSize)
  buffer.set(aliasStr, ALIAS.aliasValue)
  const filterIndex = ALIAS.filter + aliasLen
  writeUint16(buffer, filterSize, filterIndex)
  if (filterSize) {
    buffer.set(filterToBuffer(def.filter, filterIndex), filterIndex)
  }
  return { buffer, def, needsMetaResolve: def.filter.hasSubMeta }
}
