import { Ctx } from '../Ctx.js'
import { deleteProp } from './delete.js'
import { validate } from '../validate.js'
import { PROP_CURSOR_SIZE, writePropCursor } from '../cursor.js'
import { reserve } from '../resize.js'
import { writeU8 } from '../uint.js'
import type { LeafDef, SchemaVector } from '@based/schema'

export const writeVector = (
  ctx: Ctx,
  def: SchemaVector & LeafDef,
  val: any,
) => {
  if (val === null) {
    deleteProp(ctx, def)
    return
  }

  validate(val, def)

  if (val.byteLength === 0) {
    deleteProp(ctx, def)
    return
  }

  reserve(ctx, PROP_CURSOR_SIZE + 9 + val.byteLength)
  writePropCursor(ctx, def)
  writeU8(ctx, ctx.operation)

  let size = Math.min(val.byteLength, def.size * def.baseSize)
  let padding = 0
  if (ctx.index % 4 != 0) {
    padding = ctx.index % 4
  }

  size -= padding
  let tmp = size + 4

  // 16-bits would be enough but the zig expects 32-bits
  ctx.array[ctx.index++] = tmp
  ctx.array[ctx.index++] = tmp >>>= 8
  ctx.array[ctx.index++] = tmp >>>= 8
  ctx.array[ctx.index++] = tmp >>>= 8

  ctx.array[ctx.index++] = padding
  ctx.array[ctx.index++] = 0
  ctx.array[ctx.index++] = 0
  ctx.array[ctx.index++] = 0

  ctx.array.set(
    new Uint8Array(val.buffer).subarray(0, size),
    ctx.index - padding,
  )
  ctx.index += size
}
