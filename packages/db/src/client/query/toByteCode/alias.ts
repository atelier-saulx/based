import { filterToBuffer } from '../query.js'
import { QueryDef, QueryType, IntermediateByteCode } from '../types.js'
import { ENCODER, writeUint16 } from '@based/utils'

export const aliasQuery = (def: QueryDef): IntermediateByteCode => {
  const filterSize = def.filter.size || 0
  const alias = (def.target as any).resolvedAlias
  const aliasStr = ENCODER.encode(alias.value)
  const aliasLen = aliasStr.byteLength
  const buf = new Uint8Array(8 + filterSize + aliasLen)
  buf[0] = QueryType.alias
  writeUint16(buf, def.schema!.id, 1)
  buf[3] = alias.def.prop
  buf[4] = aliasLen
  buf[5] = aliasLen >>> 8
  buf.set(aliasStr, 6)
  buf[6 + aliasLen] = filterSize
  buf[7 + aliasLen] = filterSize >>> 8
  if (filterSize) {
    const x = filterToBuffer(def.filter, 8 + aliasLen)
    buf.set(x, 8 + aliasLen)
  }
  return { buffer: buf, def, needsMetaResolve: def.filter.hasSubMeta }
}
