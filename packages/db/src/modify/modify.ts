import { BasedDb } from '../index.js'
import { PropDef } from '../schema/schema.js'
import { startDrain, flushBuffer } from '../operations.js'
import { setCursor } from './setCursor.js'
import { addModify } from './addModify.js'
import { ModifyRes, _ModifyRes } from './ModifyRes.js'

export const remove = (db: BasedDb, type: string, id: number): boolean => {
  const def = db.schemaTypesParsed[type]
  const nextLen = 1 + 4 + 1 + 1
  if (db.modifyBuffer.len + nextLen > db.maxModifySize) {
    flushBuffer(db)
  }
  setCursor(db, def, 0, id)
  db.modifyBuffer.buffer[db.modifyBuffer.len] = 4
  db.modifyBuffer.len++
  if (def.seperate) {
    for (const s of def.seperate) {
      const nextLen = 1 + 4 + 1
      if (db.modifyBuffer.len + nextLen > db.maxModifySize) {
        flushBuffer(db)
      }
      setCursor(db, def, s.prop, id)
      db.modifyBuffer.buffer[db.modifyBuffer.len] = 4
      db.modifyBuffer.len++
    }
  }
  db.modifyBuffer.buffer[db.modifyBuffer.len] = 10
  db.modifyBuffer.len++
  return true
}

export const create = (db: BasedDb, type: string, value: any): ModifyRes => {
  const def = db.schemaTypesParsed[type]
  const id = ++def.lastId

  const res = new _ModifyRes(id, db)

  def.total++

  if (
    !addModify(db, id, value, def.tree, def, 3, false, true) ||
    def.mainLen === 0
  ) {
    setCursor(db, def, 0, id, false, true)
  }

  // if touched lets see perf impact here
  if (def.hasStringProp) {
    if (db.modifyBuffer.hasStringField != def.stringPropsSize - 1) {
      db.modifyBuffer.buffer[db.modifyBuffer.len] = 7
      let sizeIndex = db.modifyBuffer.len + 1
      let size = 0
      db.modifyBuffer.len += 3
      for (const x of def.stringPropsLoop) {
        if (def.stringPropsCurrent[x.prop] === 1) {
          db.modifyBuffer.buffer[db.modifyBuffer.len] = x.prop
          size += 1
          db.modifyBuffer.len += 1
        }
      }
      db.modifyBuffer.buffer.writeUint16LE(size, sizeIndex)
    }
    if (db.modifyBuffer.hasStringField != -1) {
      def.stringProps.copy(def.stringPropsCurrent)
    }
  }

  if (!db.isDraining) {
    startDrain(db)
  }

  // @ts-ignore
  return res
}

export const update = (
  db: BasedDb,
  type: string,
  id: number,
  value: any,
  overwrite?: boolean,
): ModifyRes => {
  const def = db.schemaTypesParsed[type]
  const hasMain = addModify(db, id, value, def.tree, def, 6, !overwrite, false)
  const res = new _ModifyRes(id, db)

  if (hasMain && !overwrite && db.modifyBuffer.mergeMain !== null) {
    const mergeMain = db.modifyBuffer.mergeMain
    const size = db.modifyBuffer.mergeMainSize
    if (db.modifyBuffer.len + size + 9 > db.maxModifySize) {
      flushBuffer(db)
    }
    setCursor(db, def, 0, id)
    db.modifyBuffer.buffer[db.modifyBuffer.len] = 5
    db.modifyBuffer.len += 1
    db.modifyBuffer.buffer.writeUint32LE(size, db.modifyBuffer.len)
    db.modifyBuffer.len += 4
    for (let i = 0; i < mergeMain.length; i += 2) {
      const t: PropDef = mergeMain[i]
      const v = mergeMain[i + 1]
      db.modifyBuffer.buffer.writeUint16LE(t.start, db.modifyBuffer.len)
      db.modifyBuffer.len += 2
      db.modifyBuffer.buffer.writeUint16LE(t.len, db.modifyBuffer.len)
      db.modifyBuffer.len += 2

      // 11: String
      if (t.typeIndex === 11) {
        const size = db.modifyBuffer.buffer.write(
          v,
          db.modifyBuffer.len + 1,
          'utf8',
        )
        db.modifyBuffer.buffer[db.modifyBuffer.len] = size
        if (size + 1 > t.len) {
          console.warn('String does not fit fixed len', v)
        }
      } // 1: timestamp, 4: number
      else if (t.typeIndex === 1 || t.typeIndex === 4) {
        db.modifyBuffer.buffer.writeFloatLE(v, db.modifyBuffer.len)
        // 5: uint32
      } else if (t.typeIndex === 5) {
        db.modifyBuffer.buffer.writeUint32LE(v, db.modifyBuffer.len)
        // 9: boolean
      } else if (t.typeIndex === 9) {
        db.modifyBuffer.buffer.writeInt8(v ? 1 : 0, db.modifyBuffer.len)
      }
      db.modifyBuffer.len += t.len
    }
    db.modifyBuffer.mergeMain = null
    db.modifyBuffer.mergeMainSize = 0
  }

  if (!db.isDraining) {
    startDrain(db)
  }

  // @ts-ignore
  return res
}

export { ModifyRes }
