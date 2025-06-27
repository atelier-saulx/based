import { DbWorker } from './workers/DbWorker.js'
import { DbServer } from './index.js'
import { IoJob} from './workers/io_worker_types.js'


export class IoWorker extends DbWorker {
  constructor(address: BigInt, db: DbServer) {
    const onExit = (_code: number) => {
      this.db.ioWorker = new IoWorker(address, db)
    }
    super(address, db, onExit, 'io_worker.js')
  }

  override handleMsg(_buf: any): void {
  }

  loadBlock(filepath: string): Promise<void> {
    const job: IoJob = {
      type: 'load',
      filepath
    }
    return this.call(job)
  }

  unloadBlock(filepath: string, typeId: number, start: number): Promise<void> {
    const job: IoJob = {
      type: 'unload',
      filepath,
      typeId,
      start
    }
    return this.call(job)
  }
}
