import { DbWorker } from './workers/DbWorker.ts'
import { DbServer } from './index.ts'
import { IoJob } from './workers/io_worker_types.ts'
import { DECODER, readInt32 } from '@based/utils'
import native from '../native.ts'

export class IoWorker extends DbWorker {
  constructor(address: BigInt, db: DbServer) {
    const onExit = (_code: number) => {
      this.db.ioWorker = new IoWorker(address, db)
    }
    super(address, db, onExit, 'io_worker.js')
  }

  override handleMsg(_buf: any): void {}

  private cb = (resolve: (x: any) => any) => {
    this.db.activeReaders++
    this.resolvers.push((r) => {
      this.db.activeReaders--
      resolve(r)
      //this.db.onQueryEnd()
    })
  }

  /**
   * Save given blocks and return errors and hashes in an array.
   * @returns [[4 bytes err], [16 bytes hash]][] with the same length as blocks.
   */
  async saveBlocks(
    blocks: { filepath: string; typeId: number; start: number }[],
  ): Promise<Uint8Array> {
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

  /**
   * Save a block and discard it from memory "atomically".
   * Note that this worker doesn't give any protection from other threads
   * accessing the block concurrently, and it must be coordinated in the
   * main thread.
   */
  async unloadBlock(
    filepath: string,
    typeId: number,
    start: number,
  ): Promise<Uint8Array> {
    const job: IoJob = {
      type: 'unload',
      filepath,
      typeId,
      start,
    }

    const resBuf = await this.call(job)
    const err = readInt32(resBuf, 0)
    if (err) {
      throw new Error(native.selvaStrerror(err))
    }

    // Note that this shares the original buffer which may not be 100% optimal,
    // as the first 4 bytes are no longer needed.
    return new Uint8Array(resBuf.buffer, 4)
  }
}
