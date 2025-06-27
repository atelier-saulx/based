import { DbWorker } from './workers/DbWorker.js'
import { DbServer } from './index.js'


export class IoWorker extends DbWorker {
  constructor(address: BigInt, db: DbServer) {
    const onExit = (_code: number) => {
      this.db.ioWorker = new IoWorker(address, db)
    }
    super(address, db, onExit, 'io_worker.js')
  }

  override handleMsg(_buf: any): void {
  }

  loadBlock(): Promise<void> {
    return this.call(1)
  }

  unloadBlock(): Promise<void> {
    return this.call(1)
  }
}
