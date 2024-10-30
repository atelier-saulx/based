import { BasedDb } from './index.js'

export const flushBuffer = (db: BasedDb) => {
  const ctx = db.modifyCtx
  if (ctx.len) {
    const queue = ctx.queue
    const d = Date.now()
    const offset = 0
    // TODO put actual offset here

    try {
      db.native.modify(ctx.buf.subarray(0, ctx.len), db.dbCtxExternal)
      // or it sends it to the actual db
    } catch (err) {
      console.error(err)
    }

    // add errors and reset them here
    ctx.len = 0
    ctx.prefix0 = 0
    ctx.prefix1 = 0
    ctx.field = -1
    ctx.id = -1
    ctx.lastMain = -1
    ctx.mergeMain = null
    ctx.mergeMainSize = 0
    ctx.hasStringField = -1
    ctx.ctx.offset = offset
    ctx.ctx = {}

    const time = Date.now() - d

    db.writeTime += time
    db.isDraining = false

    if (queue.size) {
      for (const [tmpId, resolve] of queue) {
        resolve(tmpId + offset)
      }
      queue.clear()
    }

    return time
  }

  db.isDraining = false
  return 0
}

export const startDrain = (db: BasedDb) => {
  db.isDraining = true
  process.nextTick(() => {
    flushBuffer(db)
  })
}
