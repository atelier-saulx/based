import { write as writeString } from '../../string.js'
import { Ctx } from '../Ctx.js'
import { reserve } from '../resize.js'
import { RANGE_ERR } from '../types.js'
import { writeU32 } from '../uint.js'
import { writeEdgeHeader } from './header.js'
import { validate } from '../validate.js'
import { LangCode, PropType } from '../../../zigTsExports.js'
import type { PropDefEdge } from '../../../schema/index.js'
import { ENCODER } from '../../../utils/uint8.js'

export const writeStringEdge = (ctx: Ctx, edge: PropDefEdge, val: any) => {
  if (val === null) {
    reserve(ctx, 3 + 4)
    writeEdgeHeader(ctx, edge, PropType.string)
    writeU32(ctx, 0)
    return
  }
  validate(val, edge)
  const maxSize =
    val instanceof Uint8Array
      ? val.byteLength
      : ENCODER.encode(val).byteLength + 6
  reserve(ctx, 3 + maxSize + 4)
  writeEdgeHeader(ctx, edge, PropType.string)
  const realSize = writeString(
    ctx,
    val,
    ctx.index + 4,
    LangCode.none,
    !edge.compression,
  )
  if (realSize === null) {
    throw RANGE_ERR
  }
  writeU32(ctx, realSize)
  ctx.index += realSize
}
