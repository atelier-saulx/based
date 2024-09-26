import { BasedDb } from '../index.js'
import { flushBuffer } from '../operations.js'
import { PropDef, SchemaTypeDef } from '../schema/types.js'
import { setCursor } from './setCursor.js'
import { writeFixedLenValue } from './writeFixedLen.js'

export function writeReferences(
  t: PropDef,
  db: BasedDb,
  writeKey: 3 | 6,
  value: any,
  schema: SchemaTypeDef,
  id: number,
  fromCreate: boolean,
) {
  // lot can be shared between reference and this
  if (t.edges) {
    // FIX
    console.log('got edges do different')
    db.modifyBuffer.buffer[db.modifyBuffer.len] = writeKey
    let refLen = 0
    if (t.edgesTotalLen) {
      console.log('EDGES')
      refLen = (t.edgesTotalLen + 5) * value.length
    } else {
      console.log('Variable len edges implement later... tmp 50 len')
      // loop trough edges and check total len
      refLen = (50 + 4 + 1) * value.length
    }

    if (refLen + 5 + db.modifyBuffer.len + 11 > db.maxModifySize) {
      flushBuffer(db)
    }

    setCursor(db, schema, t.prop, id, false, fromCreate)
    db.modifyBuffer.buffer[db.modifyBuffer.len] = writeKey
    const sizeIndex = db.modifyBuffer.len + 1
    db.modifyBuffer.len += 5

    for (let i = 0; i < value.length; i++) {
      const ref = value[i]
      if (typeof ref === 'object') {
        db.modifyBuffer.buffer[db.modifyBuffer.len] = 1
        db.modifyBuffer.buffer.writeUint32LE(ref.id, db.modifyBuffer.len + 1)
        const edgeDataSizeIndex = db.modifyBuffer.len + 5
        db.modifyBuffer.len += 9

        for (const key in t.edges) {
          if (key in ref) {
            const edge = t.edges[key]
            const value = ref[key]

            if (edge.len === 0) {
              if (edge.typeIndex === 11) {
                //
              } else if (edge.typeIndex === 13) {
                // single ref edge
              } else if (edge.typeIndex === 14) {
              }
            } else {
              // [field] [size] [data]
              db.modifyBuffer.buffer[db.modifyBuffer.len] = edge.prop
              db.modifyBuffer.buffer.writeUint16LE(
                edge.len,
                db.modifyBuffer.len + 1,
              )
              writeFixedLenValue(db, value, db.modifyBuffer.len + 3, t)
              db.modifyBuffer.len += edge.len + 3
            }
          }
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
      db.modifyBuffer.len - (sizeIndex + 5),
      sizeIndex,
    )
  } else {
    const refLen = 5 * value.length
    if (refLen + 5 + db.modifyBuffer.len + 11 > db.maxModifySize) {
      flushBuffer(db)
    }
    setCursor(db, schema, t.prop, id, false, fromCreate)
    db.modifyBuffer.buffer[db.modifyBuffer.len] = writeKey
    db.modifyBuffer.buffer.writeUint32LE(refLen, db.modifyBuffer.len + 1)
    db.modifyBuffer.len += 5
    for (let i = 0; i < value.length; i++) {
      db.modifyBuffer.buffer[db.modifyBuffer.len + i * 5] = 0
      db.modifyBuffer.buffer.writeUint32LE(
        value[i],
        i * 5 + db.modifyBuffer.len + 1,
      )
    }
    db.modifyBuffer.len += refLen
  }
}
