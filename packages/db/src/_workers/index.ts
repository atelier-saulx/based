import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Worker } from 'node:worker_threads'
import { BasedDb, ModifyCtx } from '../index.js'
import './worker.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// export class Processing {
//   constructor() {

//   }
//   payload: Buffer
//   pos() {

//   }
// }

// export class ModifyBatch {
//   constructor(ctx: ModifyCtx) {

//   }
//   buf: Buffer
//   pos () {
//     return this.buf[this.buf.byteLength - 2]
//   }
// }

export class DbWorker {
  constructor(db: BasedDb) {
    const address = db.native.intFromExternal(db.dbCtxExternal)
    const sab = new SharedArrayBuffer(12)

    this.notify = new Int32Array(sab)
    this.state = new Uint32Array(sab)

    new Worker(join(__dirname, 'worker.js'), {
      workerData: {
        address,
        sab,
        buf: db.modifyCtx.buf.buffer,
      },
    })
  }

  async modify(ctx) {
    const { min, len, queue, types } = ctx
    this.processing = types
    this.state[0] = min
    this.state[1] = len
    this.notify[2] = 1 // len

    Atomics.notify(this.notify, 2, 1)

    this.pending = Atomics.waitAsync(this.notify, 2, 1).value

    await this.pending

    for (const [tmpId, resolve] of queue) {
      resolve(tmpId)
    }

    if (ctx.max === min) {
      ctx.max = len
    }

    this.processing = null
  }

  queue = []
  notify: Int32Array
  state: Uint32Array
  processing: Set<number> | null
  pending: any

  pos() {
    return this.state[0]
  }

  // remaining() {
  //   return this.state[1] - this.state[0]
  // }
}

export const workers = (db: BasedDb, concurrency: number): DbWorker[] => {
  const workers: DbWorker[] = Array.from({ length: concurrency })
  while (concurrency--) {
    workers[concurrency] = new DbWorker(db)
  }
  return workers
}

// const msg = new Array(2)

// export class DbWorker {
//   constructor(db: BasedDb) {
//     const { port1, port2 } = new MessageChannel()
//     const atomics = new SharedArrayBuffer(8)
//     const address = db.native.intFromExternal(db.dbCtxExternal)

//     this.db = db
//     this.notify = new Int32Array(atomics)
//     this.worker = new Worker(join(__dirname, 'worker.js'), {
//       workerData: {
//         address,
//         channel: port2,
//         atomics,
//       },
//       transferList: [port2],
//     })
//     this.channel = port1
//     this.channel.on('message', (msg) => {
//       console.log('worker msg: ', msg)
//     })
//     this.worker.on('error', console.error)
//   }

//   channel: MessagePort
//   worker: Worker
//   notify: Int32Array
//   db: BasedDb
//   start: number
//   end: number
//   modify(buf) {
//     msg[0] = 1
//     msg[1] = buf
//     this.channel.postMessage(msg)
//     this.notify[1] = 1
//     Atomics.notify(this.notify, 1, 1)
//   }
// }

// export const workers = (db: BasedDb, concurrency: number) => {
//   const workers = []

//   while (concurrency--) {
//     const worker = new DbWorker(db)
//     workers.push(worker)
//   }

//   return workers
// }
