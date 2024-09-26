import { BasedDb } from '../index.js'
import { PropDef } from '../schema/schema.js'
import { startDrain, flushBuffer } from '../operations.js'
import { setCursor } from './setCursor.js'
import { addModify } from './addModify.js'
import { ModifyRes, ModifyState } from './ModifyRes.js'
import { writeFixedLenValue } from './writeFixedLen.js'

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
  const id = def.lastId + 1
  const res = new ModifyState(id, db)
  const wroteMain = addModify(db, res, value, def.tree, def, 3, false, true)

  if (res.error) {
    // @ts-ignore
    return res
  }

  def.lastId = id
  def.total++

  if (!wroteMain || def.mainLen === 0) {
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
  const res = new ModifyState(id, db)
  const hasMain = addModify(db, res, value, def.tree, def, 6, !overwrite, false)

  if (res.error) {
    db.modifyBuffer.mergeMainSize = 0
    db.modifyBuffer.mergeMain = null
    // @ts-ignore
    return res
  }

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
      writeFixedLenValue(db, v, db.modifyBuffer.len, t, res)
      db.modifyBuffer.len += t.len
    }
    db.modifyBuffer.mergeMainSize = 0
    db.modifyBuffer.mergeMain = null
  }

  if (!db.isDraining) {
    startDrain(db)
  }

  // @ts-ignore
  return res
}

export { ModifyRes }
