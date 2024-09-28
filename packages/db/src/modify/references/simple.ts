import { BasedDb } from '../../index.js'
import { flushBuffer } from '../../operations.js'
import { PropDef, PropDefEdge, SchemaTypeDef } from '../../schema/types.js'
import { modifyError, ModifyState } from '../ModifyRes.js'
import { setCursor } from '../setCursor.js'
import { ModifyOp } from '../types.js'

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
): number {
  const buf = db.modifyBuffer.buffer
  const len = db.modifyBuffer.len
  let added = 0

  for (const ref of value) {
    let id: number
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
          const $index = ref.$index
          if (typeof $index !== 'number' || $index > 2_147_483_647) {
            modifyError(res, t, value)
            return
          }
          buf[len + added] = 3
          buf.writeUint32LE(id, len + added + 1)
          buf.writeInt32LE($index, len + added + 5)
          added += 9
          console.log('Hell yeah', { $index })
          continue
        }
      } else {
        modifyError(res, t, value)
        return
      }
    } else {
      id = ref
    }
    buf[len + added] = 0
    buf.writeUint32LE(id, len + added + 1)
    added += 5
  }

  return added
}

export function overWriteSimpleReferences(
  t: PropDef,
  db: BasedDb,
  modifyOp: ModifyOp,
  value: any[],
  schema: SchemaTypeDef,
  res: ModifyState,
  op: 0 | 1 | 2,
) {
  const refLen = 9 * value.length
  const potentialLen = refLen + 1 + 5 + db.modifyBuffer.len + 11
  if (potentialLen > db.maxModifySize) {
    flushBuffer(db)
  }
  setCursor(db, schema, t.prop, res.tmpId, modifyOp)
  const len = db.modifyBuffer.len
  db.modifyBuffer.len += 6
  const added = simpleRefs(t, db, value, res)
  db.modifyBuffer.buffer[len] = modifyOp
  db.modifyBuffer.buffer.writeUint32LE(added + 1, len + 1)
  db.modifyBuffer.buffer[len + 5] = op
  db.modifyBuffer.len += added
}
