import { PropDef, PropDefEdge } from '@based/schema/def'
import { FilterCtx, MODE_REFERENCE } from './types.js'

export const createReferenceFilter = (
  prop: PropDef | PropDefEdge,
  ctx: FilterCtx,
  value: any,
) => {
  let buf: Buffer
  const len = Array.isArray(value) ? value.length : 1
  buf = Buffer.allocUnsafe(11 + len * 8)
  buf[0] = ctx.type
  buf[1] = MODE_REFERENCE
  buf[2] = prop.typeIndex
  buf.writeUInt16LE(8, 3)
  buf.writeUInt16LE(len, 5)
  buf[7] = ctx.operation
  // buf[7] = prop.typeIndex
  // REF TYPE (only 1 exists now...)
  buf[8] = 0
  buf.writeUInt16LE(prop.inverseTypeId, 9)
  if (Array.isArray(value)) {
    for (let i = 0; i < len; i++) {
      buf.writeUInt32LE(value[i], 11 + i * 8)
    }
  } else {
    buf.writeUInt32LE(value, 11)
  }
  return buf
}
