import { BasedDb } from '../../index.js'
import { PropDef } from '../../schema/types.js'
import { modifyError, ModifyState } from '../ModifyRes.js'
import { writeFixedLenValue } from '../fixedLen.js'
import { RefModify, RefModifyOpts } from './references.js'
import { simpleRefsPacked } from './simple.js'

export function getEdgeSize(t: PropDef, ref: RefModifyOpts) {
  var size = 0
  for (const key in t.edges) {
    if (key in ref) {
      const edge = t.edges[key]
      const value = ref[key]
      if (edge.len === 0) {
        if (edge.typeIndex === 11) {
          const len = value.length
          size += len + len + 4
        } else if (edge.typeIndex === 13) {
          size += 4
        } else if (edge.typeIndex === 14) {
          size += value.length * 5 + 4
        }
      } else {
        size += edge.len
      }
    }
  }
  return size
}

export function calculateEdgesSize(
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
        size += getEdgeSize(t, ref) + 6
      } else {
        modifyError(res, t, value)
        return 0
      }
    } else {
      size += 6
    }
  }
  return size
}

export function writeEdges(
  t: PropDef,
  ref: RefModifyOpts,
  db: BasedDb,
  res: ModifyState,
  skip = 0,
) {
  for (const key in t.edges) {
    if (key in ref) {
      const edge = t.edges[key]
      let value = ref[key]
      db.modifyBuffer.buffer[db.modifyBuffer.len + skip] = edge.prop
      db.modifyBuffer.buffer[db.modifyBuffer.len + skip + 1] = edge.typeIndex
      // Buffer: [field] [typeIndex] [size] [data]
      if (edge.len === 0) {
        if (edge.typeIndex === 11) {
          const size = db.modifyBuffer.buffer.write(
            value,
            db.modifyBuffer.len + 6,
            'utf8',
          )
          db.modifyBuffer.buffer.writeUint32LE(size, db.modifyBuffer.len + 2)
          db.modifyBuffer.len += size + 6
        } else if (edge.typeIndex === 13) {
          // TODO: value get id
          if (typeof value !== 'number') {
            if (value instanceof ModifyState) {
              value = value.tmpId
            } else {
              modifyError(res, t, value)
              return true
            }
          }
          db.modifyBuffer.buffer.writeUint32LE(value, db.modifyBuffer.len + 6)
          db.modifyBuffer.len += 10
        } else if (edge.typeIndex === 14) {
          const refLen = value.length * 4
          db.modifyBuffer.buffer.writeUint32LE(refLen, db.modifyBuffer.len + 2)
          db.modifyBuffer.len += 6
          simpleRefsPacked(edge, db, value, res)
          db.modifyBuffer.len += refLen
        }
      } else {
        writeFixedLenValue(db, value, db.modifyBuffer.len + 6, edge, res)
        db.modifyBuffer.len += edge.len + 6
      }
    }
  }
  return false
}
