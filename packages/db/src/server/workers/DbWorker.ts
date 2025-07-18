import { MessageChannel, Worker, MessagePort } from 'node:worker_threads'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { DbServer } from '../index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export abstract class DbWorker {
  constructor(address: BigInt, db: DbServer, onExit: (code: number) => void, workerName: string) {
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

    this.worker.on('exit', (code) => {
      if (!this.db.stopped) {
        console.info('unexpected exit query worker with code:', code)
        const err = new Error('Worker could not process query')
        for (const resolve of this.resolvers) {
          resolve(err)
        }
        this.resolvers = []
        onExit(code)
      }
    })

    this.channel.on('message', (buf) => {
      this.resolvers.shift()(new Uint8Array(buf))
      this.handleMsg(buf)
    })
  }

  protected db: DbServer
  protected channel: MessagePort
  private worker: Worker
  protected resolvers: ((x: any) => any)[] = []
  readyPromise: Promise<true>

  async terminate(): Promise<void> {
    // TODO do we want to force this.worker.terminate() after a timeout?
    await this.call(0n)
  }

  abstract handleMsg(buf: any): void

  protected callback = (resolve: (x: any) => any) => {
    this.resolvers.push(resolve)
  }

  /**
   * Send msg to the worker thread and return a promise to the response.
   */
  protected call(msg: any): Promise<Uint8Array> {
    this.channel.postMessage(msg)
    return new Promise(this.callback)
  }

  updateCtx(address: BigInt): Promise<void> {
    return this.call(address) as Promise<unknown> as Promise<void>
  }
}
