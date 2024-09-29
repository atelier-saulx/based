import { BasedDb } from '../../index.js'
import { flushBuffer } from '../../operations.js'
import { PropDef, SchemaTypeDef } from '../../schema/types.js'
import { ModifyState, modifyError } from '../ModifyRes.js'
import { setCursor } from '../setCursor.js'
import { ModifyOp } from '../types.js'
import { calculateEdgesSize, writeEdges } from './edge.js'
import { overWriteSimpleReferences } from './simple.js'

export function overWriteEdgeReferences(
  t: PropDef,
  db: BasedDb,
  modifyOp: ModifyOp,
  value: any[],
  schema: SchemaTypeDef,
  res: ModifyState,
  op: 0 | 1 | 2,
) {
  db.modifyCtx.buffer[db.modifyCtx.len] = modifyOp
  let refLen = 0

  if (t.edgesTotalLen) {
    refLen = (t.edgesTotalLen + 5) * value.length
  } else {
    refLen = calculateEdgesSize(t, value, res)
  }

  if (refLen === 0) {
    overWriteSimpleReferences(
      t,
      db,
      modifyOp,
      value,
      schema,
      res,
      op, // overwrite
    )
    return
  }

  if (refLen + 10 + db.modifyCtx.len + 11 > db.maxModifySize) {
    flushBuffer(db)
  }

  setCursor(db, schema, t.prop, res.tmpId, modifyOp)
  db.modifyCtx.buffer[db.modifyCtx.len] = modifyOp
  const sizeIndex = db.modifyCtx.len + 1
  db.modifyCtx.buffer[sizeIndex + 4] = op
  db.modifyCtx.len += 6

  for (let i = 0; i < value.length; i++) {
    let ref = value[i]
    if (typeof ref !== 'number') {
      if (ref instanceof ModifyState) {
        if (ref.error) {
          res.error = ref.error
          return
        }
        ref = ref.tmpId
      } else if (typeof ref !== 'object') {
        modifyError(res, t, value)
        return
      }
    }
    if (typeof ref === 'object') {
      db.modifyCtx.buffer[db.modifyCtx.len] = 1
      db.modifyCtx.buffer.writeUint32LE(ref.id, db.modifyCtx.len + 1)
      const edgeDataSizeIndex = db.modifyCtx.len + 5
      db.modifyCtx.len += 9
      if (writeEdges(t, ref, db, res)) {
        return
      }
      db.modifyCtx.buffer.writeUint32LE(
        db.modifyCtx.len - edgeDataSizeIndex - 4,
        edgeDataSizeIndex,
      )
    } else {
      db.modifyCtx.buffer[db.modifyCtx.len] = 0
      db.modifyCtx.buffer.writeUint32LE(ref, db.modifyCtx.len + 1)
      db.modifyCtx.len += 5
    }
  }

  db.modifyCtx.buffer.writeUint32LE(
    db.modifyCtx.len - (sizeIndex + 4),
    sizeIndex,
  )
}
