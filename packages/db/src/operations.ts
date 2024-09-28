import { BasedDb } from './index.js'

export const flushBuffer = (db: BasedDb) => {
  const mod = db.modifyCtx
  if (mod.len) {
    const queue = mod.queue
    const d = Date.now()
    const offset = 0
    // TODO put actual offset here

    try {
      db.native.modify(mod.buffer, mod.len)
      // or it sends it to the actual db
    } catch (err) {
      console.error(err)
    }

    // add errors and reset them here
    mod.len = 0
    mod.prefix0 = 0
    mod.prefix1 = 0
    mod.field = -1
    mod.id = -1
    mod.lastMain = -1
    mod.mergeMain = null
    mod.mergeMainSize = 0
    mod.hasStringField = -1
    mod.ctx.offset = offset
    mod.ctx = {}

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
