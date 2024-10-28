import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Worker, MessageChannel, MessagePort } from 'node:worker_threads'
import { BasedDb } from '../index.js'
import './worker.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const msg = new Array(2)

export class DbWorker {
  constructor(db: BasedDb) {
    const { port1, port2 } = new MessageChannel()
    const atomics = new SharedArrayBuffer(8)
    const address = db.native.intFromExternal(db.dbCtxExternal)

    this.db = db
    this.notify = new Int32Array(atomics)
    this.worker = new Worker(join(__dirname, 'worker.js'), {
      workerData: {
        address,
        channel: port2,
        atomics,
      },
      transferList: [port2],
    })
    this.channel = port1
    this.channel.on('message', (msg) => {
      console.log('worker msg: ', msg)
    })
    this.worker.on('error', console.error)
  }

  channel: MessagePort
  worker: Worker
  notify: Int32Array
  db: BasedDb
  start: number
  end: number
  modify(buf) {
    msg[0] = 1
    msg[1] = buf
    this.channel.postMessage(msg)
    this.notify[1] = 1
    Atomics.notify(this.notify, 1, 1)
  }
}

export const workers = (db: BasedDb, concurrency: number) => {
  const workers = []

  while (concurrency--) {
    const worker = new DbWorker(db)
    workers.push(worker)
  }

  return workers
}
