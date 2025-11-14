import { PropDef } from '@based/schema/def'
import { Ctx } from '../Ctx.ts'
import { deleteProp } from './delete.ts'
import { validate } from '../validate.ts'
import { ENCODER } from '@based/utils'
import { reserve } from '../resize.ts'
import { PROP_CURSOR_SIZE, writePropCursor } from '../cursor.ts'
import { writeU32, writeU8, writeU8Array } from '../uint.ts'
import { markString } from '../create/mark.ts'

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
