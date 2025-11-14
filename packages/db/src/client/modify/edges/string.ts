import type { PropDefEdge, STRING } from '@based/schema/def'
import { ENCODER } from '@based/utils'
import { write } from '../../string.ts'
import { Ctx } from '../Ctx.ts'
import { reserve } from '../resize.ts'
import { RANGE_ERR } from '../types.ts'
import { writeU32 } from '../uint.ts'
import { writeEdgeHeader } from './header.ts'
import { validate } from '../validate.ts'

export const writeStringEdge = (ctx: Ctx, edge: PropDefEdge, val: any) => {
  if (val === null) {
    reserve(ctx, 3 + 4)
    writeEdgeHeader(ctx, edge, STRING)
    writeU32(ctx, 0)
    return
  }
  validate(val, edge)
  const maxSize =
    val instanceof Uint8Array
      ? val.byteLength
      : ENCODER.encode(val).byteLength + 6
  reserve(ctx, 3 + maxSize + 4)
  writeEdgeHeader(ctx, edge, STRING)
  const realSize = write(ctx, val, ctx.index + 4, !edge.compression)
  if (realSize === null) {
    throw RANGE_ERR
  }
  writeU32(ctx, realSize)
  ctx.index += realSize
}
