import dbZig from './db.js'
import { BasedDb } from './index.js'

console.log('DB:', dbZig)

// drain write loop

// can also be a shared worker

// add write multiple
export const addWrite = (db: BasedDb, dbi: Buffer, value: Buffer) => {
  // buff
  // if anything goes wrong with a write loop retry
  // a set just gets the increased id back
  // dbZig.
  const res = dbZig.cursorSet(value, dbi)
}

// add read multiple
export const addRead = (db: BasedDb, dbi: Buffer, key: Buffer) => {
  const res = dbZig.cursorGet(key, dbi)
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
