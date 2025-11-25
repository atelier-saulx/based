import { QueryDef, includeOp, IntermediateByteCode } from '../types.js'
import { writeUint16 } from '@based/utils'
import { REFERENCE } from './offsets.js'

export const referenceQuery = (
  def: QueryDef,
  size: number,
): IntermediateByteCode => {
  const buffer = new Uint8Array(REFERENCE.baseSize)
  const sz = size + 3
  buffer[REFERENCE.includeOp] = includeOp.REFERENCE
  writeUint16(buffer, sz, REFERENCE.sizeOffset)
  writeUint16(buffer, def.schema!.id, REFERENCE.type)
  buffer[REFERENCE.prop] = (def.target as any).propDef.prop
  return { buffer, def, needsMetaResolve: def.filter.hasSubMeta }
}
