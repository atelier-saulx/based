import { BasedDb } from './index.js'

export const flushBuffer = (db: BasedDb) => {
  if (db.modifyBuffer.len) {
    const queue = db.modifyBuffer.queue
    const d = Date.now()
    const offset = 0
    // TODO put actual offset here

    try {
      db.native.modify(db.modifyBuffer.buffer, db.modifyBuffer.len)
      // or it sends it to the actual db
    } catch (err) {
      console.error(err)
    }

    // add errors and reset them here
    db.modifyBuffer.len = 0
    db.modifyBuffer.prefix0 = 0
    db.modifyBuffer.prefix1 = 0
    db.modifyBuffer.field = -1
    db.modifyBuffer.id = -1
    db.modifyBuffer.lastMain = -1
    db.modifyBuffer.mergeMain = null
    db.modifyBuffer.mergeMainSize = 0
    db.modifyBuffer.hasStringField = -1
    db.modifyBuffer.ctx.offset = offset
    db.modifyBuffer.ctx = {}

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
