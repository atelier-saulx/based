import dbZig from './db.js'
import { BasedDb } from './index.js'

console.log('DB:', dbZig)

// drain write loop

// can also be a shared worker

// add write multiple

const drain = (db: BasedDb) => {
  db.isDraining = true
  setTimeout(() => {
    const setQ = db.setQueueByDbi
    db.setQueueByDbi = new Map()
    setQ.forEach((v, k) => {
      const dbiBuffer = db.dbiIndex.get(k)
      console.log('BUF', v.length, 'DBI INDEX', k, 'DBI', dbiBuffer.toString())
      let d = Date.now()
      // fix this concat is shitty
      let bx = Buffer.concat(v)

      const res = dbZig.setBatch4(bx, dbiBuffer)
      console.info(Date.now() - d, 'ms')
    })

    db.isDraining = false
  }, 0)
}

export const addWrite = (db: BasedDb, dbi: number, value: Buffer) => {
  // buff
  // if anything goes wrong with a write loop retry
  // a set just gets the increased id back
  // dbZig.
  // PUT QUEUE

  let q = db.setQueueByDbi.get(dbi)
  if (!q) {
    q = []
    db.setQueueByDbi.set(dbi, q)
  }
  q.push(value)

  if (!db.isDraining) {
    drain(db)
  }

  // const res = dbZig.cursorSet(value, dbi)
}

// add read multiple
export const addRead = (db: BasedDb, dbi: number, key: Buffer) => {
  const res = dbZig.getBatch4(key, db.dbiIndex.get(dbi))
  return res
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
