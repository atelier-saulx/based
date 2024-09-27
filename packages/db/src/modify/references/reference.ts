import { BasedDb } from '../../index.js'
import { flushBuffer } from '../../operations.js'
import { SchemaTypeDef, PropDef } from '../../schema/types.js'
import { ModifyState, modifyError } from '../ModifyRes.js'
import { setCursor } from '../setCursor.js'
import { getEdgeSize, writeEdges } from './edge.js'
import { RefModifyOpts } from './references.js'

function writeRef(
  id: number,
  db: BasedDb,
  schema: SchemaTypeDef,
  t: PropDef,
  res: ModifyState,
  fromCreate: boolean,
  writeKey: 3 | 6,
  hasEdges: boolean,
) {
  setCursor(db, schema, t.prop, res.tmpId, false, fromCreate)
  db.modifyBuffer.buffer[db.modifyBuffer.len] = writeKey
  db.modifyBuffer.buffer[db.modifyBuffer.len + 1] = hasEdges ? 1 : 0
  db.modifyBuffer.buffer.writeUint32LE(id, db.modifyBuffer.len + 2)
  db.modifyBuffer.len += 6
}

function singleReferencEdges(
  ref: RefModifyOpts,
  db: BasedDb,
  schema: SchemaTypeDef,
  t: PropDef,
  res: ModifyState,
  fromCreate: boolean,
  writeKey: 3 | 6,
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

  db.modifyBuffer.buffer[db.modifyBuffer.len] = writeKey
  let edgesLen = 0

  if (t.edgesTotalLen) {
    edgesLen = t.edgesTotalLen
  } else {
    edgesLen = getEdgeSize(t, ref)
    if (edgesLen === 0) {
      writeRef(id, db, schema, t, res, fromCreate, writeKey, false)
      return
    }
  }

  if (6 + db.modifyBuffer.len + 11 + edgesLen > db.maxModifySize) {
    flushBuffer(db)
  }

  writeRef(id, db, schema, t, res, fromCreate, writeKey, true)
  const sizeIndex = db.modifyBuffer.len
  db.modifyBuffer.len += 4

  console.log(ref)

  writeEdges(t, ref, db, res)
  db.modifyBuffer.buffer.writeUInt32LE(
    db.modifyBuffer.len - sizeIndex - 4,
    sizeIndex,
  )
  // add edge
}

export function writeReference(
  value: number | ModifyState,
  db: BasedDb,
  schema: SchemaTypeDef,
  t: PropDef,
  res: ModifyState,
  fromCreate: boolean,
  writeKey: 3 | 6,
) {
  if (value === null) {
    const nextLen = 1 + 4 + 1
    if (db.modifyBuffer.len + nextLen > db.maxModifySize) {
      flushBuffer(db)
    }
    setCursor(db, schema, t.prop, res.tmpId, false, fromCreate)
    db.modifyBuffer.buffer[db.modifyBuffer.len] = 11
    db.modifyBuffer.len++
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
      singleReferencEdges(value, db, schema, t, res, fromCreate, writeKey)
      return
    } else {
      modifyError(res, t, value)
      return
    }
  }

  if (6 + db.modifyBuffer.len + 11 > db.maxModifySize) {
    flushBuffer(db)
  }

  writeRef(value, db, schema, t, res, fromCreate, writeKey, false)
}
