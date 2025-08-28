import { Ctx } from '../Ctx.js'
import { PropDef } from '@based/schema/def'
import { deleteProp } from './delete.js'
import { validate } from '../validate.js'
import { PROP_CURSOR_SIZE, writePropCursor } from '../cursor.js'
import { reserve } from '../resize.js'
import { writePadding, writeU32, writeU8, writeU8Array } from '../uint.js'

export const writeVector = (ctx: Ctx, def: PropDef, val: any) => {
  if (val === null) {
    deleteProp(ctx, def)
    return
  }

  validate(def, val)

  if (val.byteLength === 0) {
    deleteProp(ctx, def)
    return
  }

  reserve(ctx, PROP_CURSOR_SIZE + 9 + val.byteLength)
  writePropCursor(ctx, def)
  writeU8(ctx, ctx.operation)

  let size = Math.min(val.byteLength, def.len)
  let padding = 0

  if (ctx.index % 4 !== 0) {
    padding = ctx.index % 4
    size -= padding
  }

  writeU32(ctx, size + 4)
  writeU8(ctx, padding)
  writePadding(ctx, 3 - padding)
  writeU8Array(ctx, new Uint8Array(val.buffer).subarray(0, size))
}
