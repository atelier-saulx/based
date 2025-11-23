import { Ctx } from '../Ctx.js'
import { reserve } from '../resize.js'
import { getBuffer, writeBinaryRaw } from '../props/binary.js'
import { writeU32 } from '../uint.js'
import { writeEdgeHeader } from './header.js'
import { PROP_CURSOR_SIZE } from '../cursor.js'
import { validate } from '../validate.js'
import type { PropDefEdge } from '@based/schema'
import { PropType } from '../../../zigTsExports.js'

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
    writeEdgeHeader(ctx, edge, PropType.string)
    writeBinaryRaw(ctx, val)
  } else {
    reserve(ctx, 3 + 4)
    writeEdgeHeader(ctx, edge, PropType.string)
    writeU32(ctx, 0)
  }
}
