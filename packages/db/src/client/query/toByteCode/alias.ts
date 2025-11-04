import { filterToBuffer } from '../query.js'
import { QueryDef, QueryType } from '../types.js'
import { ENCODER, writeUint16 } from '@based/utils'
import { ALIAS } from './offsets.js'

export const aliasQuery = (def: QueryDef) => {
  const filterSize = def.filter.size || 0
  const alias = (def.target as any).resolvedAlias
  const aliasStr = ENCODER.encode(alias.value)
  const aliasLen = aliasStr.byteLength
  const buf = new Uint8Array(ALIAS.baseSize + filterSize + aliasLen)
  buf[ALIAS.queryType] = QueryType.alias
  writeUint16(buf, def.schema.id, ALIAS.type)
  buf[ALIAS.prop] = alias.def.prop
  writeUint16(buf, aliasLen, ALIAS.aliasSize)
  buf.set(aliasStr, ALIAS.aliasValue)
  writeUint16(buf, filterSize, ALIAS.filterSize + aliasLen)
  if (filterSize) {
    buf.set(filterToBuffer(def.filter), ALIAS.filter + aliasLen)
  }
  return buf
}
