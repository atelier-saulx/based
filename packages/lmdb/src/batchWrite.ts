import { BasedDb } from './index.js'
import lmdb from 'node-lmdb'

const drain = (db: BasedDb) => {
  db.isDraining = true
  // make workers as well ? maybe
  process.nextTick(() => {
    for (const w of db.writes) {
      const dbName = w[0]
      if (!db.dbis[dbName]) {
        db.dbis[dbName] = db.env.openDbi({
          name: dbName,
          create: true, // will create if database did not exist
        })
      }

      // @ts-ignore
      w[0] = db.dbis[dbName]
    }
    const listeners = db.writeListeners
    const writes: any = db.writes
    db.writes = []
    db.writeListeners = []
    db.isDraining = false
    // add db info for options!
    db.env.batchWrite(
      writes,
      // @ts-ignore
      {},
      (error, results) => {
        if (error) {
          console.error(error)
          listeners.forEach((fn) => fn(error))
        } else {
          listeners.forEach((fn) => fn())
        }
      },
    )
  })
}

export const addToWriteQueue = (
  db: BasedDb,
  writes: [string, string, Buffer][],
  cb: (err?: any) => void,
) => {
  if (db.writes.length === 0) {
    db.writes = writes
  } else {
    db.writes.push(...writes)
  }

  db.writeListeners.push(cb)
  if (!db.isDraining) {
    drain(db)
  }
}

// write worker
// const worker = (i: number) => {
//     return new Promise((resolve) => {
//       const wrk = new Worker(d + '/writerman.js', {
//         workerData: { i, amount, rounds },
//       })
//       wrk.on('message', (d) => {
//         resolve(0)
//         wrk.terminate()
//       })
//     })
//   }
