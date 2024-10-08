import { BasedDb } from '../index.js'
import { PropDef } from '../schema/schema.js'
import { startDrain, flushBuffer } from '../operations.js'
import { setCursor } from './setCursor.js'
import { addModify } from './addModify.js'
import { ModifyRes, ModifyState } from './ModifyRes.js'
import { writeFixedLenValue } from './fixedLen.js'
import { CREATE, UPDATE } from './types.js'

export const remove = (db: BasedDb, type: string, id: number): boolean => {
  const ctx = db.modifyCtx
  const def = db.schemaTypesParsed[type]
  const nextLen = 1 + 4 + 1 + 1
  const separate = def.separate

  if (ctx.len + nextLen > db.maxModifySize) {
    flushBuffer(db)
  }
  setCursor(ctx, def, 0, id, UPDATE)
  ctx.buf[ctx.len] = 4
  ctx.len++

  if (separate) {
    for (const s of separate) {
      const nextLen = 1 + 4 + 1
      if (ctx.len + nextLen > db.maxModifySize) {
        flushBuffer(db)
      }
      setCursor(ctx, def, s.prop, id, UPDATE)
      ctx.buf[ctx.len] = 4
      ctx.len++
    }
  }

  ctx.buf[ctx.len] = 10
  ctx.len++
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
  const ctx = db.modifyCtx
  const len = ctx.len

  addModify(ctx, res, obj, def, CREATE, def.tree, true)

  if (res.error !== undefined) {
    // @ts-ignore
    return res
  }

  def.lastId = id
  def.total++

  if (ctx.len === len || def.mainLen === 0) {
    setCursor(ctx, def, 0, id, CREATE)
  }

  // if touched lets see perf impact here
  if (def.hasStringProp) {
    if (ctx.hasStringField !== def.stringPropsSize - 1) {
      const sizeIndex = ctx.len + 1
      const stringPropsLoop = def.stringPropsLoop
      const stringPropsCurrent = def.stringPropsCurrent
      const buf = ctx.buf
      let size = 0
      let i = stringPropsLoop.length

      buf[ctx.len] = 7
      ctx.len += 3

      while (i--) {
        const prop = stringPropsLoop[i].prop
        if (stringPropsCurrent[prop] === 1) {
          buf[ctx.len] = prop
          size++
        }
      }

      buf[sizeIndex] = size
      buf[sizeIndex + 1] = size >>> 8
      ctx.len += size
    }

    if (ctx.hasStringField !== -1) {
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
  const ctx = db.modifyCtx

  addModify(ctx, res, obj, def, UPDATE, def.tree, overwrite)

  if (res.error) {
    ctx.mergeMainSize = 0
    ctx.mergeMain = null
    // @ts-ignore
    return res
  }

  if (ctx.mergeMain) {
    const buf = ctx.buf
    const size = ctx.mergeMainSize
    // TODO is this 9 correct?
    if (ctx.len + size + 9 > db.maxModifySize) {
      flushBuffer(db)
    }
    setCursor(ctx, def, 0, id, UPDATE)
    buf[ctx.len] = 5
    buf.writeUint32LE(size, ctx.len + 1)
    ctx.len += 5

    for (let i = 0; i < ctx.mergeMain.length; i += 2) {
      const t: PropDef = ctx.mergeMain[i]
      const v = ctx.mergeMain[i + 1]
      buf.writeUint16LE(t.start, ctx.len)
      buf.writeUint16LE(t.len, ctx.len + 2)
      writeFixedLenValue(ctx, v, ctx.len + 4, t, res)
      ctx.len += t.len + 4
    }

    ctx.mergeMainSize = 0
    ctx.mergeMain = null
  }

  if (!db.isDraining) {
    startDrain(db)
  }

  // @ts-ignore
  return res
}

export { ModifyRes }
