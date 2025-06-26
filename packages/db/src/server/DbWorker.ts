import { MessageChannel, Worker, MessagePort } from 'node:worker_threads'
import { DbServer } from './index.js'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export abstract class DbWorker {
  constructor(address: BigInt, db: DbServer, workerName: string) {
    const { port1, port2 } = new MessageChannel()

    this.db = db
    this.channel = port1
    this.worker = new Worker(join(__dirname, workerName), {
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
}
