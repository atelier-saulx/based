import dbZig from './db.js'
import { BasedDb } from './index.js'

export const modifyBuffer = {
  buffer: Buffer.allocUnsafe(50 * 1e3 * 1e3),
  len: 0,
  field: -1,
  typePrefix: new Uint8Array([0, 0]),
  id: -1,
}

export const startDrain = (db: BasedDb) => {
  // if size is large drain
  db.isDraining = true
  process.nextTick(() => {
    if (modifyBuffer.len) {
      console.info('DRAIN DAT', modifyBuffer.len, modifyBuffer.buffer)
      dbZig.modify(modifyBuffer.buffer, modifyBuffer.len)
      modifyBuffer.len = 0
      modifyBuffer.typePrefix = new Uint8Array([0, 0])
      modifyBuffer.field = -1
      modifyBuffer.id = -1
    }
    db.isDraining = false
  })
}

const drain = (db: BasedDb) => {
  db.isDraining = true
  process.nextTick(() => {
    const setQ = db.setQueueByDbi
    db.setQueueByDbi = new Map()
    setQ.forEach((v, k) => {
      const dbiBuffer = db.dbiIndex.get(k)
      var l = 0
      for (var bytes of v) {
        l += bytes.byteLength
      }
      const bufUnsafe = Buffer.allocUnsafe(l)
      let lWritten = 0
      for (var i = 0; i < v.length; i++) {
        bufUnsafe.set(v[i], lWritten)
        lWritten += v[i].byteLength
      }
      dbZig.setBatch4(bufUnsafe, dbiBuffer)
    })

    db.isDraining = false
  })
}

export const addWrite = (db: BasedDb, dbi: number, value: Buffer) => {
  let q = db.setQueueByDbi.get(dbi)
  if (!q) {
    q = []
    db.setQueueByDbi.set(dbi, q)
  }
  q.push(value)
  if (!db.isDraining) {
    drain(db)
  }
}

export const addRead = (db: BasedDb, dbi: number, key: Buffer) => {
  try {
    const res = dbZig.getBatch4(key, db.dbiIndex.get(dbi))
    return res
  } catch (e) {
    return null
  }
}

// export const addWriteBatch = (db: BasedDb, value: Buffer) => {
//   // buff
//   // if anything goes wrong with a write loop retry
//   // a set just gets the increased id back
// }

// // add read multiple
// export const addReadBatch = (
//   db: BasedDb,
//   keys: string[],
//   cb: (value: any[]) => void,
// ) => {
//   // add single and multi - this is rly nice scince we need less promises
// }

//   // conditions!
