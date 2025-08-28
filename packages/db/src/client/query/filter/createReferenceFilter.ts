import { PropDef, PropDefEdge } from '@based/schema/def'
import { ALIGNMENT_NOT_SET, FilterCtx, MODE_REFERENCE } from './types.js'
import { FilterCondition } from '../types.js'
import { writeUint16, writeUint32 } from '@based/utils'

export const createReferenceFilter = (
  prop: PropDef | PropDefEdge,
  ctx: FilterCtx,
  value: any,
): FilterCondition => {
  const isArray = Array.isArray(value)
  const len = isArray ? value.length : 1
  const buf = new Uint8Array(11 + (isArray ? 8 : 0) + len * 4)
  buf[0] = ctx.type
  buf[1] = MODE_REFERENCE
  buf[2] = prop.typeIndex
  writeUint16(buf, 4, 3) // size (4)
  writeUint16(buf, len, 5)
  buf[7] = ctx.operation
  buf[8] = 0
  writeUint16(buf, prop.inverseTypeId, 9)
  if (isArray) {
    buf[11] = ALIGNMENT_NOT_SET
    for (let i = 0; i < len; i++) {
      writeUint32(buf, value[i], 19 + i * 4)
    }
  } else {
    writeUint32(buf, value, 11)
  }
  return buf
}
