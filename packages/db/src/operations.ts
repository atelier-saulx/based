import { BasedDb } from './index.js'

export const flushBuffer = (db: BasedDb) => {
  if (db.modifyBuffer.len) {
    const d = Date.now()
    console.log('MODIFY!')
    try {
      // todo check if this is smart
      db.native.modify(db.modifyBuffer.buffer, db.modifyBuffer.len)
    } catch (err) {
      console.error(err)
    }
    console.log('MODIOFY DONE!')
    db.modifyBuffer.len = 0
    db.modifyBuffer.typePrefix = new Uint8Array([0, 0])
    db.modifyBuffer.field = -1
    db.modifyBuffer.id = -1
    db.modifyBuffer.lastMain = -1
    db.modifyBuffer.mergeMain = null
    db.modifyBuffer.mergeMainSize = 0
    db.modifyBuffer.hasStringField = -1
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
