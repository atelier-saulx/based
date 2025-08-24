import { PropDef } from '@based/schema/def'
import { Ctx } from '../Ctx.js'
import { Tmp } from '../Tmp.js'
import { resize } from '../resize.js'
import { writePropCursor } from './cursor.js'
import {
  DELETE,
  NOEDGE_NOINDEX_REALID,
  NOEDGE_NOINDEX_TMPID,
} from '../types.js'
import { writeUint32 } from '@based/utils'

const deleteReference = (ctx: Ctx, def: PropDef) => {
  resize(ctx, ctx.index + 11)
  writePropCursor(ctx, def)
  ctx.array[ctx.index] = DELETE
  ctx.index += 1
}

const writeReferenceId = (ctx: Ctx, def: PropDef, val: number) => {
  if (!def.validation(val, def)) {
    throw [def, val]
  }
  resize(ctx, ctx.index + 3 + 6)
  writePropCursor(ctx, def)
  ctx.array[ctx.index] = ctx.operation
  ctx.array[ctx.index + 1] = NOEDGE_NOINDEX_REALID
  writeUint32(ctx.array, val, ctx.index + 2)
  ctx.index += 6
}

const writeReferenceTmp = (ctx: Ctx, def: PropDef, tmp: Tmp) => {
  resize(ctx, ctx.index + 3 + 6)
  writePropCursor(ctx, def)
  ctx.array[ctx.index] = ctx.operation
  ctx.array[ctx.index + 1] = NOEDGE_NOINDEX_TMPID
  writeUint32(ctx.array, tmp.tmpId, ctx.index + 2)
  ctx.index += 6
}

const writeReferenceIdWithEdges = (ctx: Ctx, def: PropDef, val: number) => {
  if (!def.validation(val, def)) {
    throw [def, val]
  }
  resize(ctx, ctx.index + 3 + 6)
  writePropCursor(ctx, def)
  ctx.array[ctx.index] = ctx.operation
  ctx.array[ctx.index + 1] = NOEDGE_NOINDEX_REALID
  writeUint32(ctx.array, val, ctx.index + 2)
  ctx.index += 6
  const sizeIndex = ctx.index
}

export const writeReference = (
  ctx: Ctx,
  def: PropDef,
  val: number | Tmp | { id: number | Tmp },
) => {
  if (val === null) {
    deleteReference(ctx, def)
    return
  }

  if (typeof val === 'number') {
    if (def.hasDefaultEdges) {
      writeReference(ctx, def, { id: val })
      return
    }
    writeReferenceId(ctx, def, val)
    return
  }

  if (typeof val === 'object') {
    if (typeof val.id === 'number') {
      if (
        val instanceof Tmp ||
        val instanceof Promise ||
        !def.edges ||
        (def.edgesSeperateCnt === 0 && def.edgeMainLen === 0)
      ) {
        writeReferenceId(ctx, def, val.id)
        return
      }
      writeReferenceIdWithEdges(ctx, def, val.id)
      return
    }

    if (val instanceof Tmp) {
      if (val.batch !== ctx.batch) {
        throw val
      }
      if (def.hasDefaultEdges) {
        writeReference(ctx, def, { id: val })
        return
      }
      writeReferenceTmp(ctx, def, val)
      return
    }

    if (val instanceof Promise) {
      throw val
    }
  }
}
