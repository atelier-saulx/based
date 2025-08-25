import { PropDef } from '@based/schema/def'
import { Ctx } from '../Ctx.js'
import { Tmp } from '../Tmp.js'
import { reserve } from '../resize.js'
import { writePropCursor } from './cursor.js'
import {
  DELETE,
  EDGE_NOINDEX_REALID,
  EDGE_NOINDEX_TMPID,
  NOEDGE_NOINDEX_REALID,
  NOEDGE_NOINDEX_TMPID,
} from '../types.js'
import { writeUint32 } from '@based/utils'
import { writeEdges } from './edges/index.js'

const deleteReference = (ctx: Ctx, def: PropDef) => {
  reserve(ctx, 11)
  writePropCursor(ctx, def)
  ctx.array[ctx.index] = DELETE
  ctx.index += 1
}

const writeReferenceId = (
  ctx: Ctx,
  def: PropDef,
  val: number,
  operation:
    | typeof NOEDGE_NOINDEX_REALID
    | typeof NOEDGE_NOINDEX_TMPID
    | typeof EDGE_NOINDEX_REALID
    | typeof EDGE_NOINDEX_TMPID,
) => {
  if (!def.validation(val, def)) {
    throw [def, val]
  }
  reserve(ctx, 3 + 6)
  writePropCursor(ctx, def)
  ctx.array[ctx.index] = ctx.operation
  ctx.array[ctx.index + 1] = operation
  writeUint32(ctx.array, val, ctx.index + 2)
  ctx.index += 6
}

const writeReferenceEdges = (
  ctx: Ctx,
  def: PropDef,
  val: Record<string, any>,
) => {
  const index = ctx.index
  ctx.index += 4
  const start = ctx.index
  writeEdges(ctx, def, val)
  const size = ctx.index - start
  writeUint32(ctx.array, size, index)
}

export const writeReference = (
  ctx: Ctx,
  def: PropDef,
  val: number | Tmp | { id: number | Tmp | Promise<any> },
) => {
  if (typeof val === 'number') {
    if (def.hasDefaultEdges) {
      writeReferenceId(ctx, def, val, EDGE_NOINDEX_REALID)
      writeReferenceEdges(ctx, def, {})
    } else {
      writeReferenceId(ctx, def, val, NOEDGE_NOINDEX_REALID)
    }
  } else if (val === null) {
    deleteReference(ctx, def)
  } else if (typeof val === 'object') {
    const noEdges =
      !def.edges || (def.edgesSeperateCnt === 0 && def.edgeMainLen === 0)
    if (typeof val.id === 'number') {
      if (noEdges || val instanceof Tmp || val instanceof Promise) {
        writeReferenceId(ctx, def, val.id, NOEDGE_NOINDEX_REALID)
      } else {
        writeReferenceId(ctx, def, val.id, EDGE_NOINDEX_REALID)
        writeReferenceEdges(ctx, def, val)
      }
    } else if (val instanceof Tmp) {
      if (val.batch !== ctx.batch) {
        throw val
      }
      if (def.hasDefaultEdges) {
        writeReferenceId(ctx, def, val.tmpId, EDGE_NOINDEX_TMPID)
        writeReferenceEdges(ctx, def, {})
      } else {
        writeReferenceId(ctx, def, val.tmpId, NOEDGE_NOINDEX_TMPID)
      }
    } else if (val.id instanceof Tmp) {
      if (val.id.batch !== ctx.batch) {
        throw val
      }
      if (noEdges) {
        writeReferenceId(ctx, def, val.id.tmpId, NOEDGE_NOINDEX_TMPID)
      } else {
        writeReferenceId(ctx, def, val.id.tmpId, EDGE_NOINDEX_TMPID)
        writeReferenceEdges(ctx, def, val)
      }
    } else if (val instanceof Promise || val.id instanceof Promise) {
      throw val
    } else {
      throw [def, val]
    }
  } else {
    throw [def, val]
  }
}
