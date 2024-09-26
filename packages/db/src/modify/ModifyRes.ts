import { BasedDb } from '../index.js'

export type ModifyRes = {
  tmpId: number
  error?: Error
} & Promise<number>
export class _ModifyRes {
  constructor(tmpId, db) {
    this.tmpId = tmpId
    this.#db = db
  }
  #db: BasedDb
  tmpId = 0
  error?: Error;
  [Symbol.toPrimitive]() {
    return this.tmpId
  }
  then(resolve, reject) {
    if (this.error) {
      reject(this.error)
    } else {
      this.#db.modifyBuffer.queue.push(resolve, this.tmpId)
    }
  }
}
