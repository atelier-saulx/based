import type { PropDefEdge, STRING } from '@based/schema/def'
import { Ctx } from '../Ctx.ts'
import { reserve } from '../resize.ts'
import { getBuffer, writeBinaryRaw } from '../props/binary.ts'
import { writeU32 } from '../uint.ts'
import { writeEdgeHeader } from './header.ts'
import { PROP_CURSOR_SIZE } from '../cursor.ts'
import { validate } from '../validate.ts'

export const writeBinaryEdge = (ctx: Ctx, edge: PropDefEdge, val: any) => {
  let size = 0
  if (val !== null) {
    const buf = getBuffer(val)
    if (!buf) throw [edge, val]
    validate(buf, edge)
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
