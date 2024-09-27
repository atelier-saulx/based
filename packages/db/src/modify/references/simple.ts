import { BasedDb } from '../../index.js'
import { flushBuffer } from '../../operations.js'
import { PropDef, PropDefEdge, SchemaTypeDef } from '../../schema/types.js'
import { modifyError, ModifyState } from '../ModifyRes.js'
import { setCursor } from '../setCursor.js'

export function simpleRefsPacked(
  t: PropDefEdge,
  db: BasedDb,
  value: any[],
  res: ModifyState,
) {
  for (let i = 0; i < value.length; i++) {
    let ref = value[i]
    let id: number
    let $index: number
    if (typeof ref !== 'number') {
      if (ref instanceof ModifyState) {
        if (ref.error) {
          res.error = ref.error
          return
        }
        id = ref.tmpId
      } else if (typeof ref === 'object' && 'id' in ref) {
        id = ref.id
        if ('$index' in ref) {
          $index = ref.$index
        }
      } else {
        modifyError(res, t, value)
        return
      }
    } else {
      id = ref
    }
    db.modifyBuffer.buffer.writeUint32LE(id, i * 4 + db.modifyBuffer.len)
  }
}

export function simpleRefs(
  t: PropDef | PropDefEdge,
  db: BasedDb,
  value: any[],
  res: ModifyState,
) {
  for (let i = 0; i < value.length; i++) {
    let ref = value[i]
    let id: number
    let $index: number
    if (typeof ref !== 'number') {
      if (ref instanceof ModifyState) {
        if (ref.error) {
          res.error = ref.error
          return
        }
        id = ref.tmpId
      } else if (typeof ref === 'object' && 'id' in ref) {
        id = ref.id
        if ('$index' in ref) {
          $index = ref.$index
        }
      } else {
        modifyError(res, t, value)
        return
      }
    } else {
      id = ref
    }
    db.modifyBuffer.buffer[db.modifyBuffer.len + i * 5] = 0
    db.modifyBuffer.buffer.writeUint32LE(id, i * 5 + db.modifyBuffer.len + 1)
  }
}

export function overWriteSimpleReferences(
  t: PropDef,
  db: BasedDb,
  writeKey: 3 | 6,
  value: any[],
  schema: SchemaTypeDef,
  res: ModifyState,
  fromCreate: boolean,
) {
  const refLen = 5 * value.length
  if (refLen + 5 + db.modifyBuffer.len + 11 > db.maxModifySize) {
    flushBuffer(db)
  }
  setCursor(db, schema, t.prop, res.tmpId, false, fromCreate)
  db.modifyBuffer.buffer[db.modifyBuffer.len] = writeKey
  db.modifyBuffer.buffer.writeUint32LE(refLen, db.modifyBuffer.len + 1)
  db.modifyBuffer.len += 5
  simpleRefs(t, db, value, res)
  db.modifyBuffer.len += refLen
}
