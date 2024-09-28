import { BasedDb } from './index.js'

export const flushBuffer = (db: BasedDb) => {
  if (db.modifyCtx.len) {
    const queue = db.modifyCtx.queue
    const d = Date.now()
    const offset = 0
    // TODO put actual offset here

    try {
      db.native.modify(db.modifyCtx.buffer, db.modifyCtx.len)
      // or it sends it to the actual db
    } catch (err) {
      console.error(err)
    }

    // add errors and reset them here
    db.modifyCtx.len = 0
    db.modifyCtx.prefix0 = 0
    db.modifyCtx.prefix1 = 0
    db.modifyCtx.field = -1
    db.modifyCtx.id = -1
    db.modifyCtx.lastMain = -1
    db.modifyCtx.mergeMain = null
    db.modifyCtx.mergeMainSize = 0
    db.modifyCtx.hasStringField = -1
    db.modifyCtx.ctx.offset = offset
    db.modifyCtx.ctx = {}

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
