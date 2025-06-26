import { DbWorker } from './DbWorker.js'
import { DbServer } from './index.js'
import { readUint64 } from '@saulx/utils'

export class QueryWorker extends DbWorker {
  constructor(address: BigInt, db: DbServer, workerIndex: number) {
    super(address, db, 'query_worker.js')

    this.worker.on('exit', (code) => {
      if (!this.db.stopped) {
        console.info('unexpected exit query worker with code:', code)
        const err = new Error('Worker could not process query')
        for (const resolve of this.resolvers) {
          resolve(err)
        }
        this.resolvers = []
        this.db.workers[workerIndex] = new QueryWorker(address, db, workerIndex)
      }
    })

    this.channel.on('message', (buf) => {
      this.resolvers.shift()(new Uint8Array(buf))
      this.db.onQueryEnd()
    })
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
