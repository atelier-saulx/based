import { Ctx } from '../Ctx.ts'
import type { PropDef } from '@based/schema/def'
import { deleteProp } from './delete.ts'
import { validate } from '../validate.ts'
import { PROP_CURSOR_SIZE, writePropCursor } from '../cursor.ts'
import { reserve } from '../resize.ts'
import { writeU8 } from '../uint.ts'

export const writeVector = (ctx: Ctx, def: PropDef, val: any) => {
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

  let size = Math.min(val.byteLength, def.len)
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
