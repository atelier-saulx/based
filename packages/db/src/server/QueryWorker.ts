import { DbWorker } from './workers/DbWorker.js'
import { DbServer } from './index.js'
import { readUint64 } from '@saulx/utils'

export class QueryWorker extends DbWorker {
  constructor(address: BigInt, db: DbServer, workerIndex: number) {
    const onExit = (_code: number) => {
      this.db.workers[workerIndex] = new QueryWorker(address, db, workerIndex)
    }
    super(address, db, onExit, 'query_worker.js')
  }

  override handleMsg(_buf: any): void {
    this.db.processingQueries--
    this.db.onQueryEnd()
  }

  protected override callback = (resolve: (x: any) => any) => {
    this.db.processingQueries++
    this.resolvers.push(resolve)
  }

  getQueryBuf(buf: Uint8Array): Promise<Uint8Array> {
    const schemaChecksum = readUint64(buf, buf.byteLength - 8)
    if (schemaChecksum !== this.db.schema?.hash) {
      return Promise.resolve(new Uint8Array(1))
    }

    return this.call(buf)
  }
}
