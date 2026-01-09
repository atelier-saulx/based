import type { PropDef } from '../../../schema.js'
import { writeUint32 } from '../../../utils/uint8.js'
import { ModOp, RefOp, type RefOpEnum } from '../../../zigTsExports.js'
import type { Ctx } from '../Ctx.js'
import { PROP_CURSOR_SIZE, writePropCursor } from '../cursor.js'
import { reserve } from '../resize.js'
import { writeU32, writeU8 } from '../uint.js'

export const writeReferences = (ctx: Ctx, def: PropDef, val: any) => {
  if (typeof val !== 'object') {
    throw [def, val]
  }

  if (val === null) {
    reserve(ctx, PROP_CURSOR_SIZE + 1)
    writePropCursor(ctx, def)
    writeU8(ctx, ModOp.delete)
    return
  }

  if (Array.isArray(val)) {
    reserve(ctx, PROP_CURSOR_SIZE + 1 + 1 + val.length * 9) // very defensive TODO make exact
    writePropCursor(ctx, def)
    writeU8(ctx, ctx.operation)

    if (ctx.operation === ModOp.updateProp) {
      writeU8(ctx, RefOp.clear)
    }

    let op: RefOpEnum | undefined
    let pos = 0
    let len = 0

    for (const item of val) {
      let id: number
      let nextOp: RefOpEnum
      if (typeof item === 'number') {
        id = item
        nextOp = RefOp.set
      } else if (typeof item === 'object' && item !== null && item.id) {
        id = item.id
        nextOp = RefOp.set
      } else {
        // not handled yet
        throw new Error('references payload, not handled yet - wip')
      }

      if (op !== nextOp!) {
        if (op) {
          // write previous len
          writeUint32(ctx.buf, len * 4, pos)
        }
        writeU8(ctx, (op = nextOp!))
        pos = ctx.index
        len = 0
        ctx.index += 4
      }

      writeU32(ctx, id)
      len++
    }

    writeUint32(ctx.buf, len * 4, pos)
    writeU8(ctx, RefOp.end)
    return
  }
}
