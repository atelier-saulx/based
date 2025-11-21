import { Ctx } from '../Ctx.js'
import { Tmp } from '../Tmp.js'
import { reserve } from '../resize.js'
import { PROP_CURSOR_SIZE, writePropCursor } from '../cursor.js'
import {
  EDGE_NOINDEX_REALID,
  EDGE_NOINDEX_TMPID,
  NOEDGE_NOINDEX_REALID,
  NOEDGE_NOINDEX_TMPID,
} from '../types.js'
import { writeEdges } from '../edges/index.js'
import { deleteProp } from './delete.js'
import { writeU32, writeU8 } from '../uint.js'
import { validate } from '../validate.js'
import type { LeafDef } from '@based/schema'

const writeReferenceId = (
  ctx: Ctx,
  def: LeafDef,
  val: number,
  refOp:
    | typeof NOEDGE_NOINDEX_REALID
    | typeof NOEDGE_NOINDEX_TMPID
    | typeof EDGE_NOINDEX_REALID
    | typeof EDGE_NOINDEX_TMPID,
) => {
  reserve(ctx, PROP_CURSOR_SIZE + 6)
  writePropCursor(ctx, def)
  writeU8(ctx, ctx.operation)
  writeU8(ctx, refOp)
  writeU32(ctx, val)
}

export const writeReference = (
  ctx: Ctx,
  def: LeafDef,
  val: number | Tmp | { id: number | Tmp | Promise<any> },
) => {
  if (val === null) {
    deleteProp(ctx, def)
    return
  }

  if (typeof val === 'number') {
    validate(val, def)
    if (def.hasDefaultEdges) {
      writeReferenceId(ctx, def, val, EDGE_NOINDEX_REALID)
      writeEdges(ctx, def, {}, true)
    } else {
      writeReferenceId(ctx, def, val, NOEDGE_NOINDEX_REALID)
    }
    return
  }

  if (typeof val === 'object') {
    if (typeof val.id === 'object') {
      if (val.id === null) {
        throw [def, val]
      }
      if ('then' in val.id && typeof val.id.then === 'function') {
        // @ts-ignore
        const resolvedId = val.id.id
        if (resolvedId) {
          // @ts-ignore
          val.id = resolvedId
        }
      }
    }

    if (typeof val.id === 'number') {
      validate(val.id, def)
      if (!def.edges || val instanceof Tmp || val instanceof Promise) {
        writeReferenceId(ctx, def, val.id, NOEDGE_NOINDEX_REALID)
      } else {
        writeReferenceId(ctx, def, val.id, EDGE_NOINDEX_REALID)
        writeEdges(ctx, def, val, true)
      }
      return
    }

    if (val.id instanceof Tmp) {
      if (val.id.batch !== ctx.batch) {
        throw val.id
      }
      if (!def.edges) {
        writeReferenceId(ctx, def, val.id.tmpId, NOEDGE_NOINDEX_TMPID)
      } else {
        writeReferenceId(ctx, def, val.id.tmpId, EDGE_NOINDEX_TMPID)
        writeEdges(ctx, def, val, true)
      }
      return
    }

    if (val instanceof Tmp) {
      if (val.batch !== ctx.batch) {
        throw val
      }
      if (def.hasDefaultEdges) {
        writeReferenceId(ctx, def, val.tmpId, EDGE_NOINDEX_TMPID)
        writeEdges(ctx, def, {}, true)
      } else {
        writeReferenceId(ctx, def, val.tmpId, NOEDGE_NOINDEX_TMPID)
      }
      return
    }

    if (val.id instanceof Promise) {
      throw val.id
    }

    if (val instanceof Promise) {
      throw val
    }
  }

  throw [def, val]
}
