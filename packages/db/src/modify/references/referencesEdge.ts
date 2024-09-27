import { BasedDb } from '../../index.js'
import { flushBuffer } from '../../operations.js'
import { PropDef, SchemaTypeDef } from '../../schema/types.js'
import { ModifyState, modifyError } from '../ModifyRes.js'
import { setCursor } from '../setCursor.js'
import { calculateEdgesSize, writeEdges } from './edge.js'
import { overWriteSimpleReferences } from './simple.js'

export function overWriteEdgeReferences(
  t: PropDef,
  db: BasedDb,
  writeKey: 3 | 6,
  value: any[],
  schema: SchemaTypeDef,
  res: ModifyState,
  fromCreate: boolean,
) {
  db.modifyBuffer.buffer[db.modifyBuffer.len] = writeKey
  let refLen = 0

  if (t.edgesTotalLen) {
    refLen = (t.edgesTotalLen + 5) * value.length
  } else {
    refLen = calculateEdgesSize(t, value, res) + 5
  }

  if (refLen === 0) {
    overWriteSimpleReferences(
      t,
      db,
      writeKey,
      value,
      schema,
      res,
      fromCreate,
      0, // overwrite
    )
    return
  }

  if (refLen + 5 + db.modifyBuffer.len + 11 > db.maxModifySize) {
    flushBuffer(db)
  }

  setCursor(db, schema, t.prop, res.tmpId, false, fromCreate)
  db.modifyBuffer.buffer[db.modifyBuffer.len] = writeKey
  const sizeIndex = db.modifyBuffer.len + 1
  db.modifyBuffer.buffer[sizeIndex + 4] = 0
  db.modifyBuffer.len += 6

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
      db.modifyBuffer.buffer[db.modifyBuffer.len] = 1
      db.modifyBuffer.buffer.writeUint32LE(ref.id, db.modifyBuffer.len + 1)
      const edgeDataSizeIndex = db.modifyBuffer.len + 5
      db.modifyBuffer.len += 9
      if (writeEdges(t, ref, db, res)) {
        return
      }
      db.modifyBuffer.buffer.writeUint32LE(
        db.modifyBuffer.len - edgeDataSizeIndex - 4,
        edgeDataSizeIndex,
      )
    } else {
      db.modifyBuffer.buffer[db.modifyBuffer.len] = 0
      db.modifyBuffer.buffer.writeUint32LE(ref, db.modifyBuffer.len + 1)
      db.modifyBuffer.len += 5
    }
  }

  db.modifyBuffer.buffer.writeUint32LE(
    db.modifyBuffer.len - (sizeIndex + 4),
    sizeIndex,
  )
}
