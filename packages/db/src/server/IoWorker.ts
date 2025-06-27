import { DbWorker } from './DbWorker.js'
import { DbServer } from './index.js'


export class IoWorker extends DbWorker {
  constructor(address: BigInt, db: DbServer) {
    const onExit = (_code: number) => {
      this.db.ioWorker = new IoWorker(address, db)
    }
    super(address, db, onExit, 'io_worker.js')
  }

  override handleMsg(buf: any): void {
    // TODO
    console.log(buf)
  }

  // TODO
  //getQueryBuf(buf: Uint8Array): Promise<Uint8Array> {
  //  const schemaChecksum = readUint64(buf, buf.byteLength - 8)
  //  if (schemaChecksum !== this.db.schema?.hash) {
  //    return Promise.resolve(new Uint8Array(1))
  //  }

  //this.call(buf)
  //}
}
