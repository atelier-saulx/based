import { BasedDb } from '../index.js'
import { PropDef } from '../schema/schema.js'
import { startDrain, flushBuffer } from '../operations.js'
import { setCursor } from './setCursor.js'
import { addModify } from './addModify.js'
import { ModifyRes, ModifyState } from './ModifyRes.js'
import { writeFixedLenValue } from './fixedLen.js'
import { CREATE, UPDATE } from './types.js'

export const remove = (db: BasedDb, type: string, id: number): boolean => {
  const def = db.schemaTypesParsed[type]
  const nextLen = 1 + 4 + 1 + 1
  if (db.modifyBuffer.len + nextLen > db.maxModifySize) {
    flushBuffer(db)
  }
  setCursor(db, def, 0, id, UPDATE)
  db.modifyBuffer.buffer[db.modifyBuffer.len] = 4
  db.modifyBuffer.len++
  if (def.separate) {
    for (const s of def.separate) {
      const nextLen = 1 + 4 + 1
      if (db.modifyBuffer.len + nextLen > db.maxModifySize) {
        flushBuffer(db)
      }
      setCursor(db, def, s.prop, id, UPDATE)
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
  const wroteMain = addModify(db, res, value, def.tree, def, CREATE, false)

  if (res.error) {
    // @ts-ignore
    return res
  }

  def.lastId = id
  def.total++

  if (!wroteMain || def.mainLen === 0) {
    setCursor(db, def, 0, id, CREATE)
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
  const merge = !overwrite
  const hasMain = addModify(db, res, value, def.tree, def, UPDATE, merge)

  if (res.error) {
    const m = db.modifyBuffer
    m.mergeMainSize = 0
    m.mergeMain = null
    // @ts-ignore
    return res
  }

  if (hasMain && merge) {
    const m = db.modifyBuffer
    const mergeMain = m.mergeMain
    if (mergeMain !== null) {
      const buf = m.buffer
      const size = m.mergeMainSize
      // TODO is this 9 correct?
      if (m.len + size + 9 > db.maxModifySize) {
        flushBuffer(db)
      }
      setCursor(db, def, 0, id, UPDATE)
      let pos = m.len
      buf[pos] = 5
      buf.writeUint32LE(size, pos + 1)
      pos += 5
      for (let i = 0; i < mergeMain.length; i += 2) {
        const t: PropDef = mergeMain[i]
        const v = mergeMain[i + 1]
        buf.writeUint16LE(t.start, pos)
        buf.writeUint16LE(t.len, pos + 2)
        writeFixedLenValue(db, v, pos + 4, t, res)
        pos += t.len + 4
      }
      m.mergeMainSize = 0
      m.mergeMain = null
      m.len = pos
    }
  }

  if (!db.isDraining) {
    startDrain(db)
  }

  // @ts-ignore
  return res
}

export { ModifyRes }
