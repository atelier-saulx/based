import { MessageChannel, Worker, MessagePort } from 'node:worker_threads'
import { DbServer } from './index.js'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const workerPath = join(__dirname, 'worker.js')

export class DbWorker {
  constructor(address: BigInt, db: DbServer) {
    const { port1, port2 } = new MessageChannel()
    this.db = db
    this.channel = port1
    this.worker = new Worker(workerPath, {
      workerData: {
        isDbWorker: true,
        channel: port2,
        address,
      },
      transferList: [port2],
    })

    port1.on('message', (buf) => {
      this.resolvers.shift()(new Uint8Array(buf))
      this.db.onQueryEnd()
    })
  }

  db: DbServer
  channel: MessagePort
  worker: Worker
  resolvers: any[] = []

  callback = (resolve) => {
    this.db.processingQueries++
    this.resolvers.push(resolve)
  }

  updateCtx(address: BigInt): Promise<void> {
    this.channel.postMessage(address)
    return new Promise(this.callback)
  }

  getQueryBuf(buf: Uint8Array): Promise<Uint8Array> {
    this.channel.postMessage(buf)
    return new Promise(this.callback)
  }
}
