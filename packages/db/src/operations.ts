import { BasedDb } from './index.js'

export const flushBuffer = (db: BasedDb) => {
  if (db.modifyBuffer.len) {
    db.native.modify(db.modifyBuffer.buffer, db.modifyBuffer.len)
    db.modifyBuffer.len = 0
    db.modifyBuffer.typePrefix = new Uint8Array([0, 0])
    db.modifyBuffer.field = -1
    db.modifyBuffer.id = -1
    db.modifyBuffer.lastMain = -1
  }
}

export const startDrain = (db: BasedDb) => {
  // if size is large drain
  db.isDraining = true
  process.nextTick(() => {
    flushBuffer(db)
    db.isDraining = false
  })
}
