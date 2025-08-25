import { PropDefEdge, STRING } from '@based/schema/def'
import { ENCODER } from '@based/utils'
import { write } from '../../../string.js'
import { Ctx } from '../../Ctx.js'
import { reserve } from '../../resize.js'
import { RANGE_ERR } from '../../types.js'
import { writeU32 } from '../uint.js'
import { writeEdgeHeader } from './header.js'

export const writeStringEdge = (ctx: Ctx, edge: PropDefEdge, val: any) => {
  if (val === null) {
    reserve(ctx, 3 + 4)
    writeEdgeHeader(ctx, edge, STRING)
    writeU32(ctx, 0)
    return
  }
  if (!edge.validation(val, edge)) {
    throw [val, edge]
  }
  const maxSize =
    val instanceof Uint8Array
      ? val.byteLength
      : ENCODER.encode(val).byteLength + 6
  reserve(ctx, 3 + maxSize + 4)
  writeEdgeHeader(ctx, edge, STRING)
  const realSize = write(ctx.array, val, ctx.index + 4, !edge.compression)
  if (realSize === null) {
    throw RANGE_ERR
  }
  writeU32(ctx, realSize)
  ctx.index += realSize
}
