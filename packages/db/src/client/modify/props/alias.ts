import { Ctx } from '../Ctx.js'
import { deleteProp } from './delete.js'
import { validate } from '../validate.js'
import { ENCODER } from '@based/utils'
import { reserve } from '../resize.js'
import { PROP_CURSOR_SIZE, writePropCursor } from '../cursor.js'
import { writeU32, writeU8, writeU8Array } from '../uint.js'
import { markString } from '../create/mark.js'
import type { PropDef } from '@based/schema'

export const writeAlias = (ctx: Ctx, def: PropDef, val: any) => {
  if (val === null) {
    deleteProp(ctx, def)
    return
  }

  validate(val, def)

  const buf = ENCODER.encode(val)
  if (buf.byteLength === 0) {
    deleteProp(ctx, def)
    return
  }

  reserve(ctx, PROP_CURSOR_SIZE + 5 + buf.byteLength)
  writePropCursor(ctx, def)
  writeU8(ctx, ctx.operation)
  writeU32(ctx, buf.byteLength)
  writeU8Array(ctx, buf)
  markString(ctx, def)
}
