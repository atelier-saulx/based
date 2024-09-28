import { BasedDb } from '../../index.js'
import { SchemaTypeDef, PropDef } from '../../schema/types.js'
import { ModifyState, modifyError } from '../ModifyRes.js'
import { ModifyOp } from '../types.js'
import { maybeFlush } from '../utils.js'
import { getEdgeSize, writeEdges } from './edge.js'
import { RefModifyOpts } from './references.js'

function writeRef(
  db: BasedDb,
  id: number,
  modifyOp: ModifyOp,
  hasEdges: boolean,
) {
  const ctx = db.modifyCtx
  const buf = ctx.buffer
  buf[ctx.len] = modifyOp
  buf[ctx.len + 1] = hasEdges ? 1 : 0
  buf.writeUint32LE(id, ctx.len + 2)
  ctx.len += 6
}

function singleReferencEdges(
  ref: RefModifyOpts,
  db: BasedDb,
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

  const ctx = db.modifyCtx
  const buf = ctx.buffer

  buf[ctx.len] = modifyOp

  let edgesLen = 0
  if (t.edgesTotalLen) {
    edgesLen = t.edgesTotalLen
  } else {
    edgesLen = getEdgeSize(t, ref)
    if (edgesLen === 0) {
      writeRef(db, id, modifyOp, false)
      return
    }
  }

  maybeFlush(db, 6 + 11 + edgesLen)
  writeRef(db, id, modifyOp, true)

  const sizeIndex = ctx.len
  ctx.len += 4
  writeEdges(t, ref, db, res)
  buf.writeUInt32LE(ctx.len - sizeIndex, sizeIndex)
  // add edge
}

export function writeReference(
  value: number | ModifyState,
  db: BasedDb,
  t: PropDef,
  res: ModifyState,
  modifyOp: ModifyOp,
) {
  if (value === null) {
    const ctx = db.modifyCtx
    const nextLen = 1 + 4 + 1
    maybeFlush(db, nextLen)
    ctx.buffer[ctx.len] = 11
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
      singleReferencEdges(value, db, t, res, modifyOp)
      return
    } else {
      modifyError(res, t, value)
      return
    }
  }

  maybeFlush(db, 6 + 11)
  writeRef(db, value, modifyOp, false)
}
