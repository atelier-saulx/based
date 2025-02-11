import {
  isPropDef,
  PropDef,
  PropDefEdge,
  REVERSE_TYPE_INDEX_MAP,
  SchemaPropTree,
} from '../../server/schema/types.js'
import { ModifyCtx } from '../../index.js'
import { inspect } from 'node:util'
import { SubscriptionMarkersCheck } from '../query/subscription/index.js'
import { DbClient } from '../index.js'
import { ModifyOpts } from './types.js'
import { LangCode } from '@based/schema'

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
    subMarkers: SubscriptionMarkersCheck | false,
    opts?: ModifyOpts,
  ) {
    this.tmpId = tmpId
    this.#typeId = typeId
    this.#buf = db.modifyCtx
    this.#ctx = db.modifyCtx.ctx
    this.subMarkers = subMarkers
    if (opts) {
      if (opts.i18n) {
        this.i18n = opts.i18n
      }
    }
  }

  subMarkers: SubscriptionMarkersCheck | false
  i18n: LangCode

  #buf: ModifyCtx
  #ctx: ModifyCtx['ctx']
  #typeId: number
  tmpId: number
  error?: ModifyError
  promises?: Promise<any>[];
  [Symbol.toPrimitive]() {
    return this.tmpId
  }

  getId(offsets: Record<number, number>) {
    const offset = offsets[this.#typeId] || 0
    return this.tmpId + offset
  }

  then(resolve, reject) {
    const promise = new Promise((resolve) => {
      if (this.error) {
        reject(new Error(this.error.toString()))
      } else if ('offsets' in this.#ctx) {
        resolve(this.getId(this.#ctx.offsets))
      } else {
        this.#buf.queue.set(resolve, this)
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
