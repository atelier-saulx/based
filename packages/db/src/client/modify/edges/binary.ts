import { PropDefEdge, STRING } from '@based/schema/def'
import { Ctx } from '../Ctx.js'
import { reserve, resize } from '../resize.js'
import { getBuffer, writeBinaryRaw } from '../props/binary.js'
import { writeU32 } from '../uint.js'
import { writeEdgeHeader } from './header.js'
import { PROP_CURSOR_SIZE } from '../cursor.js'

export const writeBinaryEdge = (ctx: Ctx, edge: PropDefEdge, val: any) => {
  let size = 0
  if (val !== null) {
    const buf = getBuffer(val)
    if (!buf || !edge.validation(buf, edge)) {
      throw [edge, val]
    }
    size = buf.byteLength
    val = buf
  }

  if (size) {
    reserve(ctx, PROP_CURSOR_SIZE + size + 10)
    writeEdgeHeader(ctx, edge, STRING)
    writeBinaryRaw(ctx, val)
  } else {
    reserve(ctx, 3 + 4)
    writeEdgeHeader(ctx, edge, STRING)
    writeU32(ctx, 0)
  }
}
