import { ALIGNMENT_NOT_SET, FilterCtx, MODE_REFERENCE } from './types.js'
import { FilterCondition } from '../types.js'
import { writeUint16, writeUint32 } from '@based/utils'
import type { PropDef, PropDefEdge } from '@based/schema'

export const createReferenceFilter = (
  prop: PropDef | PropDefEdge,
  ctx: FilterCtx,
  value: any,
): FilterCondition => {
  const isArray = Array.isArray(value)
  const len = isArray ? value.length : 1
  const buffer = new Uint8Array(11 + (isArray ? 8 : 0) + len * 4)
  buffer[0] = ctx.type
  buffer[1] = MODE_REFERENCE
  buffer[2] = prop.typeIndex
  writeUint16(buffer, 4, 3) // size (4)
  writeUint16(buffer, len, 5)
  buffer[7] = ctx.operation
  buffer[8] = 0
  writeUint16(buffer, prop.inverseTypeId!, 9)
  if (isArray) {
    buffer[11] = ALIGNMENT_NOT_SET
    for (let i = 0; i < len; i++) {
      writeUint32(buffer, value[i], 19 + i * 4)
    }
  } else {
    writeUint32(buffer, value, 11)
  }
  return { buffer, propDef: prop }
}
