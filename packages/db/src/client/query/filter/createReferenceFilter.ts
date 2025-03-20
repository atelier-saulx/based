import { PropDef, PropDefEdge } from '@based/schema/def'
import { FilterCtx, MODE_REFERENCE } from './types.js'

export const createReferenceFilter = (
  prop: PropDef | PropDefEdge,
  ctx: FilterCtx,
  value: any,
): Uint8Array => {
  const len = Array.isArray(value) ? value.length : 1
  const buf = new Uint8Array(11 + len * 8)

  buf[0] = ctx.type
  buf[1] = MODE_REFERENCE
  buf[2] = prop.typeIndex
  buf[3] = 8
  buf[4] = 8 >>> 8
  buf[5] = len
  buf[6] = len >>> 8
  buf[7] = ctx.operation
  // buf[7] = prop.typeIndex
  // REF TYPE (only 1 exists now...)
  buf[8] = 0
  buf[9] = prop.inverseTypeId
  buf[10] = prop.inverseTypeId >>> 8
  if (Array.isArray(value)) {
    for (let i = 0; i < len; i++) {
      let off = 11 + i * 8
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
