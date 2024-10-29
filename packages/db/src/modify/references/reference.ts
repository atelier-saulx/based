import { BasedDb } from '../../index.js'
import { flushBuffer } from '../../operations.js'
import { SchemaTypeDef, PropDef } from '../../schema/types.js'
import { ModifyState, modifyError } from '../ModifyRes.js'
import { setCursor } from '../setCursor.js'
import { ModifyOp } from '../types.js'
import { getEdgeSize, writeEdges } from './edge.js'
import { RefModifyOpts } from './references.js'

function writeRef(
  id: number,
  ctx: BasedDb['modifyCtx'],
  schema: SchemaTypeDef,
  t: PropDef,
  res: ModifyState,
  modifyOp: ModifyOp,
  hasEdges: boolean,
) {
  ctx.db.markNodeDirty(t.inverseTypeId, id)
  setCursor(ctx, schema, t.prop, res.tmpId, modifyOp)
  ctx.buf[ctx.len] = modifyOp
  ctx.buf[ctx.len + 1] = hasEdges ? 1 : 0
  ctx.buf.writeUint32LE(id, ctx.len + 2)
  ctx.len += 6
}

function singleReferencEdges(
  ref: RefModifyOpts,
  ctx: BasedDb['modifyCtx'],
  schema: SchemaTypeDef,
  t: PropDef,
  res: ModifyState,
  modifyOp: ModifyOp,
) {
  const id =
    typeof ref.id === 'number'
      ? ref.id
      : ref.id instanceof ModifyState
        ? ref.id.tmpId
        : 0

  if (id === 0) {
    modifyError(res, t, ref)
    return
  }

  ctx.buf[ctx.len] = modifyOp
  let edgesLen = 0

  if (t.edgesTotalLen) {
    edgesLen = t.edgesTotalLen
  } else {
    edgesLen = getEdgeSize(t, ref)
    if (edgesLen === 0) {
      writeRef(id, ctx, schema, t, res, modifyOp, false)
      return
    }
  }

  if (6 + ctx.len + 11 + edgesLen > ctx.max) {
    flushBuffer(ctx.db)
  }

  writeRef(id, ctx, schema, t, res, modifyOp, true)
  const sizeIndex = ctx.len
  ctx.len += 4
  writeEdges(t, ref, ctx, res)
  ctx.buf.writeUInt32LE(ctx.len - sizeIndex, sizeIndex)
  // add edge
}

export function writeReference(
  value: number | ModifyState,
  ctx: BasedDb['modifyCtx'],
  schema: SchemaTypeDef,
  t: PropDef,
  res: ModifyState,
  modifyOp: ModifyOp,
) {
  if (value === null) {
    const nextLen = 1 + 4 + 1
    if (ctx.len + nextLen > ctx.max) {
      flushBuffer(ctx.db)
    }
    setCursor(ctx, schema, t.prop, res.tmpId, modifyOp)
    ctx.buf[ctx.len] = 11
    ctx.len++
    return
  }

  if (typeof value !== 'number') {
    if (value instanceof ModifyState) {
      if (value.error) {
        res.error = value.error
        return
      }
      value = value.tmpId
    } else if (t.edges && typeof value === 'object') {
      singleReferencEdges(value, ctx, schema, t, res, modifyOp)
      return
    } else {
      modifyError(res, t, value)
      return
    }
  }

  if (6 + ctx.len + 11 > ctx.max) {
    flushBuffer(ctx.db)
  }

  writeRef(value, ctx, schema, t, res, modifyOp, false)
}
