import dbZig from './db.js'
import { BasedDb } from './index.js'

console.log('DB:', dbZig)

// drain write loop

// can also be a shared worker

// add write multiple
export const addWrite = (
  db: BasedDb,
  dbi: string,
  key: number,
  value: Buffer,
) => {
  // buff
  // if anything goes wrong with a write loop retry
  // a set just gets the increased id back
}

// add read multiple
export const addRead = (
  db: BasedDb,
  dbi: string,
  key: number,
  cb: (value: any) => void,
) => {
  // add single and multi - this is rly nice scince we need less promises
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
