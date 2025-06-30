import { PropDef, PropDefEdge } from '@based/schema/def'
import { ALIGNMENT_NOT_SET, FilterCtx, MODE_REFERENCE } from './types.js'
import { FilterCondition } from '../types.js'

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
  // size (4)
  buf[3] = 4
  buf[4] = 0
  buf[5] = len
  buf[6] = len >>> 8
  buf[7] = ctx.operation
  buf[8] = 0
  buf[9] = prop.inverseTypeId
  buf[10] = prop.inverseTypeId >>> 8
  if (isArray) {
    buf[11] = ALIGNMENT_NOT_SET
    for (let i = 0; i < len; i++) {
      let off = 19 + i * 4
      const v = value[i]
      buf[off++] = v
      buf[off++] = v >>> 8
      buf[off++] = v >>> 16
      buf[off++] = v >>> 24
    }
  } else {
    buf[11] = value
    buf[12] = value >>> 8
    buf[13] = value >>> 16
    buf[14] = value >>> 24
  }
  return buf
}
