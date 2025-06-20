import { MessageChannel, Worker, MessagePort } from 'node:worker_threads'
import { DbServer } from './index.js'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { readUint64 } from '@saulx/utils'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const workerPath = join(__dirname, 'worker.js')

export class DbWorker {
  constructor(address: BigInt, db: DbServer, workerIndex: number) {
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

    this.readyPromise = new Promise((resolve) => {
      const onReady = (msg: string) => {
        if (msg === 'READY') {
          this.worker.off('message', onReady)
          resolve(true)
        }
      }
      this.worker.on('message', onReady)
    })

    this.worker.on('error', (err) => {
      console.error('error in query worker:', err)
      this.worker.terminate().catch((err) => {
        console.error('error terminating query worker:', err)
      })
    })

    this.worker.on('exit', (code) => {
      if (!this.db.stopped) {
        console.info('unexpected exit query worker with code:', code)
        const err = new Error('Worker could not process query')
        for (const resolve of this.resolvers) {
          resolve(err)
        }
        this.resolvers = []
        this.db.workers[workerIndex] = new DbWorker(address, db, workerIndex)
      }
    })

    port1.on('message', (buf) => {
      this.resolvers.shift()(new Uint8Array(buf))
      this.db.onQueryEnd()
    })
  }

  db: DbServer
  channel: MessagePort
  worker: Worker
  resolvers: ((x: any) => any)[] = []
  readyPromise: Promise<true>

  callback = (resolve: (x: any) => any) => {
    this.db.processingQueries++
    this.resolvers.push(resolve)
  }

  updateCtx(address: BigInt): Promise<void> {
    this.channel.postMessage(address)
    return new Promise(this.callback)
  }

  getQueryBuf(buf: Uint8Array): Promise<Uint8Array> {
    const schemaChecksum = readUint64(buf, buf.byteLength - 8)
    if (schemaChecksum !== this.db.schema?.hash) {
      return Promise.resolve(new Uint8Array(1))
    }
    this.channel.postMessage(buf)
    return new Promise(this.callback)
  }
}
