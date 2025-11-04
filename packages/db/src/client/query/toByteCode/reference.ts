import { QueryDef, includeOp } from '../types.js'
import { writeUint16 } from '@based/utils'
import { REFERENCE } from './offsets.js'

export const referenceQuery = (def: QueryDef, size: number) => {
  const buf = new Uint8Array(REFERENCE.baseSize)
  const sz = size + 3
  buf[REFERENCE.includeOp] = includeOp.REFERENCE
  writeUint16(buf, sz, REFERENCE.sizeOffset)
  writeUint16(buf, def.schema.id, REFERENCE.type)
  buf[REFERENCE.prop] = (def.target as any).propDef.prop
  return buf
}
