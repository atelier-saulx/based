import {
  isPropDef,
  PropDef,
  PropDefEdge,
  REVERSE_TYPE_INDEX_MAP,
  SchemaPropTree,
} from '../../server/schema/types.js'
import { BasedDb, ModifyCtx } from '../../index.js'
import { inspect } from 'node:util'
import { SubscriptionMarkers } from '../query/subscription/index.js'
import { DbClient } from '../index.js'

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

export class ModifyError {
  constructor(
    prop: PropDef | PropDefEdge | SchemaPropTree,
    val: any,
    msg?: string,
  ) {
    this.#prop = prop
    this.#val = val
    this.#msg = msg
  }
  #msg: string
  #prop: PropDef | PropDefEdge | SchemaPropTree
  #val: any
  toString() {
    if (isPropDef(this.#prop)) {
      if (this.#msg) {
        return `Invalid value at '${this.#prop.path.join('.')}'. Expected ${this.#msg} received '${parseVal(this.#val)}'`
      }
      return `Invalid value at '${this.#prop.path.join('.')}'. Expected ${REVERSE_TYPE_INDEX_MAP[this.#prop.typeIndex]}, received '${parseVal(this.#val)}'`
    }

    return `Unknown property '${this.#val}'. Expected one of: ${Object.keys(this.#prop).join(', ')}`
  }

  [inspect.custom]() {
    return this.toString()
  }
}

export class ModifyState {
  constructor(
    typeId: number,
    tmpId: number,
    db: DbClient,
    subMarkers: SubscriptionMarkers,
  ) {
    this.tmpId = tmpId
    this.#typeId = typeId
    this.#buf = db.modifyCtx
    this.#ctx = db.modifyCtx.ctx
    this.subMarkers = subMarkers
  }

  subMarkers?: SubscriptionMarkers

  #buf: ModifyCtx
  #ctx: ModifyCtx['ctx']
  #typeId: number
  tmpId: number
  error?: ModifyError
  promises?: Promise<any>[];
  [Symbol.toPrimitive]() {
    return this.tmpId
  }
  then(resolve, reject) {
    const promise = new Promise((resolve) => {
      if (this.error) {
        reject(new Error(this.error.toString()))
      } else if ('offset' in this.#ctx) {
        const offset = this.#ctx.offsets?.[this.#typeId] || 0
        resolve(this.tmpId + offset)
      } else {
        this.#buf.queue.set(resolve, this.tmpId)
      }
    })
    if (this.promises?.length) {
      return Promise.allSettled(this.promises)
        .then(() => promise)
        .then(resolve, reject)
    } else {
      return promise.then(resolve, reject)
    }
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
