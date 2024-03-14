import { BasedDb } from './index.js'

const drain = () => {}

const addToWriteQueue = (db: BasedDb) => {}

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
