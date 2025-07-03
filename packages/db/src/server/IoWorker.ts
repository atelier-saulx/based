import { DbWorker } from './workers/DbWorker.js'
import { DbServer } from './index.js'
import { IoJob} from './workers/io_worker_types.js'
import { DECODER, readInt32 } from '@saulx/utils'


export class IoWorker extends DbWorker {
  constructor(address: BigInt, db: DbServer) {
    const onExit = (_code: number) => {
      this.db.ioWorker = new IoWorker(address, db)
    }
    super(address, db, onExit, 'io_worker.js')
  }

  override handleMsg(_buf: any): void {
  }

  override async terminate(): Promise<number> {
    const job: IoJob = {
      type: 'terminate',
    }
    await this.call(job)
    return 0
  }

  private cb = (resolve: (x: any) => any) => {
    this.db.activeReaders++
    this.resolvers.push((r) => {
      this.db.activeReaders--
      resolve(r)
      //this.db.onQueryEnd()
    })
  }

  async saveBlocks(blocks: { filepath: string, typeId: number, start: number }[]): Promise<Uint8Array> {
    const job: IoJob = {
      type: 'save',
      blocks,
    }

    this.channel.postMessage(job)
    const resBufP = new Promise(this.cb)
    resBufP.then(() => this.db.onQueryEnd())
    return resBufP
  }

  async loadBlock(filepath: string): Promise<void> {
    const job: IoJob = {
      type: 'load',
      filepath,
    }

    const resBuf = await this.call(job)
    if (resBuf.length) {
      throw new Error(DECODER.decode(resBuf))
    }
  }

  async unloadBlock(filepath: string, typeId: number, start: number): Promise<Uint8Array> {
    const job: IoJob = {
      type: 'unload',
      filepath,
      typeId,
      start,
    }

    const resBuf = await this.call(job)
    const err = readInt32(resBuf, 0)
    if (err) {
      throw new Error(`selva error: ${err}`)
    }

    // Note that this shares the original buffer which may not be 100% optimal,
    // as the first 4 bytes are no longer needed.
    return new Uint8Array(resBuf.buffer, 4)
  }
}
