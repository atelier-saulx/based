import { BasedDb } from '../../index.js'
import { flushBuffer } from '../../operations.js'
import { PropDef, SchemaTypeDef } from '../../schema/types.js'
import { modifyError, ModifyState } from '../ModifyRes.js'
import { setCursor } from '../setCursor.js'
import { writeFixedLenValue } from '../fixedLen.js'
import { RefModify, RefModifyOpts } from './references.js'

function getEdgeSize(t: PropDef, ref: RefModifyOpts) {
  var size = 0
  for (const key in t.edges) {
    if (key in ref) {
      const edge = t.edges[key]
      const value = ref[key]
      if (edge.len === 0) {
        if (edge.typeIndex === 11) {
          // string
        } else if (edge.typeIndex === 13) {
          // single ref edge
        } else if (edge.typeIndex === 14) {
          // multi ref
        }
      } else {
        size += edge.len
      }
    }
  }
  return size
}

function calculateEdgesSize(
  t: PropDef,
  value: RefModify[],
  res: ModifyState,
): number {
  let size = 0
  for (let i = 0; i < value.length; i++) {
    let ref = value[i]
    if (typeof ref !== 'number') {
      if (ref instanceof ModifyState) {
        ref = ref.tmpId
      } else if (typeof ref === 'object') {
        size += getEdgeSize(t, ref) + 5
      } else {
        modifyError(res, t, value)
        return 0
      }
    } else {
      size += 5
    }
  }
  return size
}

function writeEdges(
  t: PropDef,
  ref: RefModifyOpts,
  db: BasedDb,
  res: ModifyState,
) {
  for (const key in t.edges) {
    if (key in ref) {
      const edge = t.edges[key]
      const value = ref[key]

      if (edge.len === 0) {
        if (edge.typeIndex === 11) {
          // string
        } else if (edge.typeIndex === 13) {
          // single ref edge
        } else if (edge.typeIndex === 14) {
          // multi ref
        }
      } else {
        // [field] [size] [data]
        db.modifyBuffer.buffer[db.modifyBuffer.len] = edge.prop
        db.modifyBuffer.buffer.writeUint16LE(edge.len, db.modifyBuffer.len + 1)
        writeFixedLenValue(db, value, db.modifyBuffer.len + 3, edge, res)
        db.modifyBuffer.len += edge.len + 3
      }
    }
  }
}

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
    refLen = calculateEdgesSize(t, value, res)
    if (refLen === 0) {
      return
    }
    refLen += 5
  }

  if (refLen + 5 + db.modifyBuffer.len + 11 > db.maxModifySize) {
    flushBuffer(db)
  }

  setCursor(db, schema, t.prop, res.tmpId, false, fromCreate)
  db.modifyBuffer.buffer[db.modifyBuffer.len] = writeKey
  const sizeIndex = db.modifyBuffer.len + 1
  db.modifyBuffer.len += 5

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
      writeEdges(t, ref, db, res)
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
