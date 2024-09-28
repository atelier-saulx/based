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

const MAGIC_KEY = Math.random().toString(36).substring(2)
const MAGIC_REG = RegExp(`("${MAGIC_KEY}|${MAGIC_KEY}")`, 'g')
const walk = (val) => {
  if (typeof val === 'object' && val !== null) {
    if (Array.isArray(val)) {
      return val.map(walk)
    }
    const obj = {}
    for (const key in val) {
      obj[MAGIC_KEY + key + MAGIC_KEY] = walk(val[key])
    }
    return obj
  }
  return val
}
const parseVal = (val) => {
  if (typeof val === 'object' && val !== null) {
    return JSON.stringify(walk(val)).replace(MAGIC_REG, '')
  }
  return val
}

class ModifyError {
  constructor(prop: PropDef | PropDefEdge | SchemaPropTree, val: any) {
    this.#prop = prop
    this.#val = val
  }
  #prop: PropDef | PropDefEdge | SchemaPropTree
  #val: any
  toString() {
    if (isPropDef(this.#prop)) {
      return `Invalid value at '${this.#prop.path.join('.')}'. Expected ${REVERSE_TYPE_INDEX_MAP[this.#prop.typeIndex]}, received ${parseVal(this.#val)}`
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
    this.#buf = db.modifyCtx
    this.#ctx = db.modifyCtx.ctx
  }
  #buf: BasedDb['modifyCtx']
  #ctx: BasedDb['modifyCtx']['ctx']
  tmpId: number
  error?: ModifyError;
  [Symbol.toPrimitive]() {
    return this.tmpId
  }
  then(resolve, reject) {
    return new Promise((resolve) => {
      if (this.error) {
        reject(new Error(this.error.toString()))
      } else if ('offset' in this.#ctx) {
        resolve(this.tmpId + this.#ctx.offset)
      } else {
        this.#buf.queue.set(this.tmpId, resolve)
      }
    }).then(resolve, reject)
  }
  catch(handler) {
    if (this.error) {
      return new Promise((resolve) => {
        resolve(handler(new Error(this.error.toString())))
      })
    }
    return this
  }
}

export const modifyError = (
  res: ModifyState,
  prop: PropDef | PropDefEdge | SchemaPropTree,
  val: any,
) => {
  res.error = new ModifyError(prop, val)
  console.info(res.error.toString())
}
