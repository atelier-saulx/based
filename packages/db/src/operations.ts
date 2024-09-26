import { BasedDb } from './index.js'

export const flushBuffer = (db: BasedDb) => {
  if (db.modifyBuffer.len) {
    console.log('db.modifyBuffer.len:', db.modifyBuffer.len)
    const d = Date.now()
    const offset = 0
    // TODO put actual offset here

    try {
      // todo check if this is smart
      db.native.modify(db.modifyBuffer.buffer, db.modifyBuffer.len)
      // or it sends it to the actual db
    } catch (err) {
      console.error(err)
    }
    // add errors and reset them here
    db.modifyBuffer.len = 0
    db.modifyBuffer.typePrefix = new Uint8Array([0, 0])
    db.modifyBuffer.field = -1
    db.modifyBuffer.id = -1
    db.modifyBuffer.lastMain = -1
    db.modifyBuffer.mergeMain = null
    db.modifyBuffer.mergeMainSize = 0
    db.modifyBuffer.hasStringField = -1
    db.modifyBuffer.ctx.offset = offset
    db.modifyBuffer.ctx = {}

    const q = db.modifyBuffer.queue
    let i = q.length

    if (i) {
      // resolve any queued ModifyRes's
      while (i--) {
        const tmpId = q[i]
        const resolve = q[--i]
        resolve(tmpId + offset)
      }
      db.modifyBuffer.queue = []
    }

    const time = Date.now() - d
    db.writeTime += time

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
