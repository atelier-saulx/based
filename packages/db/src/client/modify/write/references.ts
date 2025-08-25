import { Ctx } from '../Ctx.js'
import { PropDef, REFERENCES } from '@based/schema/def'
import { reserve } from '../resize.js'
import { writePropCursor } from './cursor.js'
import { DELETE, REF_OP_OVERWRITE } from '../types.js'
import { writeU32 } from './uint.js'
import { Tmp } from '../Tmp.js'

const deleteReferences = (ctx: Ctx, def: PropDef) => {
  reserve(ctx, 3 + 1)
  writePropCursor(ctx, def)
  ctx.array[ctx.index++] = DELETE
}

const overwriteReferences = (ctx: Ctx, def: PropDef, val: any): number => {
  ctx.array[ctx.index++] = ctx.operation
  writeU32(ctx, val.length * 4)
  ctx.array[ctx.index++] = REF_OP_OVERWRITE
  let index = 0
  for (const id of val) {
    if (typeof id === 'number') {
      if (!def.validation(id, def)) {
        throw [def, val]
      }
      index++
      writeU32(ctx, id)
      continue
    }
    if (typeof id === 'object' && id !== null && id.id) {
      for (const key in id) {
        if (key[0] === '$') {
          return
        }
      }
      index++
      writeU32(ctx, id.id)
      continue
    }
  }
  return index
}

export const writeReferences = (ctx: Ctx, def: PropDef, val: any) => {
  if (typeof val !== 'object') {
    throw [def, val]
  }

  if (val === null) {
    deleteReferences(ctx, def)
    return
  }

  if (Array.isArray(val)) {
    if (!val.length) {
      deleteReferences(ctx, def)
      return
    }
    reserve(ctx, 19 + val.length * 4)
    writePropCursor(ctx, def)
    const start = ctx.index
    const index = overwriteReferences(ctx, def, val)
    if (index) {
      ctx.array[ctx.index++] = 0
      ctx.array[ctx.index++] = REFERENCES
    } else {
      ctx.index = start
    }
    reserve(ctx, 10)
    // WIP!
  }
}
