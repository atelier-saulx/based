import dbZig from './db.js'
import { BasedDb } from './index.js'

const drain = (db: BasedDb) => {
  db.isDraining = true
  process.nextTick(() => {
    const setQ = db.setQueueByDbi
    db.setQueueByDbi = new Map()
    setQ.forEach((v, k) => {
      const dbiBuffer = db.dbiIndex.get(k)

      console.log('WRITE', dbiBuffer.toString(), v.length)

      // fix this concat is shitty
      dbZig.setBatch4(Buffer.concat(v), dbiBuffer)
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
