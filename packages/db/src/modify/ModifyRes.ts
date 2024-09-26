import { BasedDb } from '../index.js'
import { PropDef, REVERSE_TYPE_INDEX_MAP } from '../schema/types.js'

export type ModifyRes = {
  tmpId: number
  error?: Error
} & Promise<number>

class ModifyError {
  constructor(prop: PropDef, val: any) {
    this.#prop = prop
    this.#val = val
  }
  #prop: PropDef
  #val: PropDef
  toError() {
    return new Error(
      `Invalid value at ${this.#prop.path.join('.')}. Expected ${REVERSE_TYPE_INDEX_MAP[this.#prop.typeIndex]}, received ${this.#val}`,
    )
  }
}

export class _ModifyRes {
  constructor(tmpId, db) {
    this.tmpId = tmpId
    this.#buf = db.modifyBuffer
    this.#ctx = db.modifyBuffer.ctx
  }
  #buf: BasedDb['modifyBuffer']
  #ctx: BasedDb['modifyBuffer']['ctx']
  tmpId: number
  error?: ModifyError;
  [Symbol.toPrimitive]() {
    return this.tmpId
  }
  then(resolve, reject) {
    if (this.error) {
      reject(this.error.toError())
    }
    if ('offset' in this.#ctx) {
      resolve(this.tmpId + this.#ctx.offset)
    } else {
      this.#buf.queue.push(resolve, this.tmpId)
    }
  }
  _fail(prop: PropDef, val: any) {
    // store error info
    this.error = new ModifyError(prop, val)
  }
}
