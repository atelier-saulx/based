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
  db: BasedDb,
  schema: SchemaTypeDef,
  t: PropDef,
  res: ModifyState,
  modifyOp: ModifyOp,
  hasEdges: boolean,
) {
  setCursor(db, schema, t.prop, res.tmpId, modifyOp)
  db.modifyCtx.buffer[db.modifyCtx.len] = modifyOp
  db.modifyCtx.buffer[db.modifyCtx.len + 1] = hasEdges ? 1 : 0
  db.modifyCtx.buffer.writeUint32LE(id, db.modifyCtx.len + 2)
  db.modifyCtx.len += 6
}

function singleReferencEdges(
  ref: RefModifyOpts,
  db: BasedDb,
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

  db.modifyCtx.buffer[db.modifyCtx.len] = modifyOp
  let edgesLen = 0

  if (t.edgesTotalLen) {
    edgesLen = t.edgesTotalLen
  } else {
    edgesLen = getEdgeSize(t, ref)
    if (edgesLen === 0) {
      writeRef(id, db, schema, t, res, modifyOp, false)
      return
    }
  }

  if (6 + db.modifyCtx.len + 11 + edgesLen > db.maxModifySize) {
    flushBuffer(db)
  }

  writeRef(id, db, schema, t, res, modifyOp, true)
  const sizeIndex = db.modifyCtx.len
  db.modifyCtx.len += 4
  writeEdges(t, ref, db, res)
  db.modifyCtx.buffer.writeUInt32LE(db.modifyCtx.len - sizeIndex, sizeIndex)
  // add edge
}

export function writeReference(
  value: number | ModifyState,
  db: BasedDb,
  schema: SchemaTypeDef,
  t: PropDef,
  res: ModifyState,
  modifyOp: ModifyOp,
) {
  if (value === null) {
    const nextLen = 1 + 4 + 1
    if (db.modifyCtx.len + nextLen > db.maxModifySize) {
      flushBuffer(db)
    }
    setCursor(db, schema, t.prop, res.tmpId, modifyOp)
    db.modifyCtx.buffer[db.modifyCtx.len] = 11
    db.modifyCtx.len++
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
      singleReferencEdges(value, db, schema, t, res, modifyOp)
      return
    } else {
      modifyError(res, t, value)
      return
    }
  }

  if (6 + db.modifyCtx.len + 11 > db.maxModifySize) {
    flushBuffer(db)
  }

  writeRef(value, db, schema, t, res, modifyOp, false)
}
