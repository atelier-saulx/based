import {
  isPropDef,
  PropDef,
  PropDefEdge,
  REVERSE_TYPE_INDEX_MAP,
  SchemaPropTree,
} from '../schema/types.js'
import { BasedDb } from '../index.js'
import { inspect } from 'node:util'

export type ModifyRes = {
  tmpId: number
  error?: Error
} & Promise<number>

class ModifyError {
  constructor(prop: PropDef | PropDefEdge | SchemaPropTree, val: any) {
    this.#prop = prop
    this.#val = val
  }
  #prop: PropDef | PropDefEdge | SchemaPropTree
  #val: any
  toString() {
    if (isPropDef(this.#prop)) {
      return `Invalid value at '${this.#prop.path.join('.')}'. Expected ${REVERSE_TYPE_INDEX_MAP[this.#prop.typeIndex]}, received ${this.#val}`
    }

    return `Unknown property '${this.#val}'. Expected one of: ${Object.keys(this.#prop).join(', ')}`
  }

  [inspect.custom]() {
    return this.toString()
  }
}

export class ModifyState {
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
      reject(this.error.toString())
    }
    if ('offset' in this.#ctx) {
      resolve(this.tmpId + this.#ctx.offset)
    } else {
      this.#buf.queue.push(resolve, this.tmpId)
    }
  }
}

export const modifyError = (
  res: ModifyState,
  prop: PropDef | PropDefEdge | SchemaPropTree,
  val: any,
) => {
  res.error = new ModifyError(prop, val)
}
