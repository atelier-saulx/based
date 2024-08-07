import { BasedDb } from './index.js'

export const flushBuffer = (db: BasedDb) => {
  if (db.modifyBuffer.len) {
    const d = Date.now()
    db.native.modify(
      db.modifyBuffer.buffer,
      db.modifyBuffer.len,
      db.modifyBuffer.emptyMainBuffer,
    )
    db.modifyBuffer.len = 0
    db.modifyBuffer.typePrefix = new Uint8Array([0, 0])
    db.modifyBuffer.field = -1
    db.modifyBuffer.id = -1
    db.modifyBuffer.lastMain = -1
    db.modifyBuffer.mergeMain = null
    db.modifyBuffer.mergeMainSize = 0
    return Date.now() - d
  }
  return 0
}

export const startDrain = (db: BasedDb) => {
  // if size is large drain
  db.isDraining = true
  process.nextTick(() => {
    flushBuffer(db)
    db.isDraining = false
  })
}
