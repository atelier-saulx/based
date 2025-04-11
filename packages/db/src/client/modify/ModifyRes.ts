import {
  isPropDef,
  PropDef,
  PropDefEdge,
  REVERSE_TYPE_INDEX_MAP,
  SchemaPropTree,
} from '@based/schema/def'
import { ModifyCtx } from '../../index.js'
import { SubscriptionMarkersCheck } from '../query/subscription/index.js'
import { DbClient } from '../index.js'
import { ModifyOpts } from './types.js'
import { LangCode, langCodesMap } from '@based/schema'

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
    const str = JSON.stringify(walk(val)).replace(MAGIC_REG, '')
    val = str
  }
  if (typeof val === 'string' && val.length > 35) {
    return val.slice(0, 35) + `... (${val.length - 35} more characters)`
  }
  return val
}

const parseErrorMsg = (
  prop: PropDef | PropDefEdge | SchemaPropTree,
  val: any,
  msg?: string,
) => {
  if (isPropDef(prop)) {
    if (msg) {
      return `Invalid value at '${prop.path.join('.')}'. Expected ${msg} received '${parseVal(val)}'`
    }
    return `Invalid value at '${prop.path.join('.')}'. Expected ${REVERSE_TYPE_INDEX_MAP[prop.typeIndex]}, received '${parseVal(val)}'`
  }
  return `Unknown property '${val}'. Expected one of: ${Object.keys(prop).join(', ')}`
}

export class ModifyError extends Error {
  constructor(
    prop: PropDef | PropDefEdge | SchemaPropTree,
    val: any,
    msg?: string,
  ) {
    super(parseErrorMsg(prop, val, msg))
    const a = this.stack.split('\n')
    this.stack = a[0] + '\n' + a.slice(6, -1).join('\n')
  }
}

export class ModifyState {
  constructor(
    typeId: number,
    tmpId: number,
    db: DbClient,
    subMarkers: SubscriptionMarkersCheck | false,
    opts: ModifyOpts,
    update = false,
  ) {
    this.tmpId = tmpId
    this.#typeId = typeId
    this.#buf = db.modifyCtx
    this.#ctx = db.modifyCtx.ctx
    this.subMarkers = subMarkers
    this.update = update
    if (opts?.locale) {
      this.locale = langCodesMap.get(opts.locale)
    }
  }

  subMarkers: SubscriptionMarkersCheck | false
  update: boolean
  locale: LangCode

  #buf: ModifyCtx
  #ctx: ModifyCtx['ctx']
  #typeId: number

  tmpId: number
  error?: ModifyError
  promises?: Promise<any>[]

  getId() {
    if (this.update) {
      return this.tmpId
    }
    if ('offsets' in this.#ctx) {
      const offset = this.#ctx.offsets[this.#typeId] || 0
      return this.tmpId + offset
    }
  }

  then(resolve, reject) {
    const promise = new Promise((resolve) => {
      if (this.error) {
        reject(new Error(this.error.toString()))
      } else if ('offsets' in this.#ctx) {
        resolve(this.getId())
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
