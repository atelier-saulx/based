import { BasedDb } from '../index.js'

export type ModifyRes = {
  tmpId: number
  error?: Error
} & Promise<number>

export class _ModifyRes {
  constructor(tmpId, db) {
    this.tmpId = tmpId
    this.#buf = db.modifyBuffer
    this.#ctx = db.modifyBuffer.ctx
  }
  #buf: BasedDb['modifyBuffer']
  #ctx: BasedDb['modifyBuffer']['ctx']
  tmpId = 0
  error?: Error;
  [Symbol.toPrimitive]() {
    return this.tmpId
  }
  then(resolve, reject) {
    if (this.error) {
      reject(this.error)
    }
    if ('offset' in this.#ctx) {
      resolve(this.tmpId + this.#ctx.offset)
    } else {
      this.#buf.queue.push(resolve, this.tmpId)
    }
  }
}
