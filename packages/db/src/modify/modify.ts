import { BasedDb } from '../index.js'
import { PropDef } from '../schema/schema.js'
import { startDrain, flushBuffer } from '../operations.js'
import { setCursor } from './setCursor.js'
import { addModify } from './addModify.js'
import { ModifyRes, ModifyState } from './ModifyRes.js'
import { writeFixedLenValue } from './fixedLen.js'
import { CREATE, UPDATE } from './types.js'

export const remove = (db: BasedDb, type: string, id: number): boolean => {
  const mod = db.modifyCtx
  const def = db.schemaTypesParsed[type]
  const nextLen = 1 + 4 + 1 + 1
  const separate = def.separate

  if (mod.len + nextLen > db.maxModifySize) {
    flushBuffer(db)
  }
  setCursor(db, def, 0, id, UPDATE)
  mod.buffer[mod.len] = 4
  mod.len++

  if (separate) {
    for (const s of separate) {
      const nextLen = 1 + 4 + 1
      if (mod.len + nextLen > db.maxModifySize) {
        flushBuffer(db)
      }
      setCursor(db, def, s.prop, id, UPDATE)
      mod.buffer[mod.len] = 4
      mod.len++
    }
  }

  mod.buffer[mod.len] = 10
  mod.len++
  return true
}

export const create = (
  db: BasedDb,
  type: string,
  obj: Record<string, any>,
): ModifyRes => {
  const def = db.schemaTypesParsed[type]
  const id = def.lastId + 1
  const res = new ModifyState(id, db)
  const mod = db.modifyCtx
  const len = mod.len

  addModify(db, res, obj, def, CREATE, def.tree, true)

  if (res.error !== undefined) {
    // @ts-ignore
    return res
  }

  def.lastId = id
  def.total++

  if (mod.len === len || def.mainLen === 0) {
    setCursor(db, def, 0, id, CREATE)
  }

  // if touched lets see perf impact here
  if (def.hasStringProp) {
    if (mod.hasStringField !== def.stringPropsSize - 1) {
      const sizeIndex = mod.len + 1
      const stringPropsLoop = def.stringPropsLoop
      const stringPropsCurrent = def.stringPropsCurrent
      const buf = mod.buffer
      let size = 0
      let i = stringPropsLoop.length

      buf[mod.len] = 7
      mod.len += 3

      while (i--) {
        const prop = stringPropsLoop[i].prop
        if (stringPropsCurrent[prop] === 1) {
          buf[mod.len] = prop
          size++
        }
      }

      buf[sizeIndex] = size
      buf[sizeIndex + 1] = size >>> 8
      mod.len += size
    }

    if (mod.hasStringField !== -1) {
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
  obj: Record<string, any>,
  overwrite?: boolean,
): ModifyRes => {
  const def = db.schemaTypesParsed[type]
  const res = new ModifyState(id, db)

  addModify(db, res, obj, def, UPDATE, def.tree, overwrite)

  const mod = db.modifyCtx

  if (res.error) {
    mod.mergeMainSize = 0
    mod.mergeMain = null
    // @ts-ignore
    return res
  }

  if (mod.mergeMain) {
    const buf = mod.buffer
    const size = mod.mergeMainSize
    // TODO is this 9 correct?
    if (mod.len + size + 9 > db.maxModifySize) {
      flushBuffer(db)
    }
    setCursor(db, def, 0, id, UPDATE)
    buf[mod.len] = 5
    buf.writeUint32LE(size, mod.len + 1)
    mod.len += 5

    for (let i = 0; i < mod.mergeMain.length; i += 2) {
      const t: PropDef = mod.mergeMain[i]
      const v = mod.mergeMain[i + 1]
      buf.writeUint16LE(t.start, mod.len)
      buf.writeUint16LE(t.len, mod.len + 2)
      writeFixedLenValue(db, v, mod.len + 4, t, res)
      mod.len += t.len + 4
    }

    mod.mergeMainSize = 0
    mod.mergeMain = null
  }

  if (!db.isDraining) {
    startDrain(db)
  }

  // @ts-ignore
  return res
}

export { ModifyRes }
