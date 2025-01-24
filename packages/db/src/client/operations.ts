import { BasedDb } from '../index.js'
import { PropDef } from '../server/schema/types.js'
import { DbClient } from './index.js'

export class ModifyCtx {
  constructor(db: DbClient) {
    this.max = db.maxModifySize
    this.db = db
    this.buf = Buffer.allocUnsafe(db.maxModifySize)
  }

  // default values
  len: number = 0
  id = -1
  lastMain = -1
  hasStringField = -1
  queue = new Map<(payload: any) => void, any>()
  ctx: { offset?: number } = {} // maybe make this different?

  payload: Buffer

  max: number
  buf: Buffer

  field: number
  prefix0: number = -1
  prefix1: number = -1

  mergeMain: (PropDef | any)[] | null
  mergeMainSize: number

  db: DbClient
}

export const flushBuffer = (db: DbClient) => {
  const ctx = db.modifyCtx
  let flushPromise: Promise<void>

  if (ctx.len) {
    const d = Date.now()
    flushPromise = db.hooks
      .flushModify(ctx.buf.subarray(0, ctx.len))
      .then(() => {
        db.writeTime += Date.now() - d
      })

    ctx.len = 0
    ctx.prefix0 = -1
    ctx.prefix1 = -1

    if (ctx.queue.size) {
      const queue = ctx.queue
      ctx.queue = new Map()
      flushPromise.then(() => {
        for (const [resolve, payload] of queue) {
          resolve(payload)
        }
      })
    }
  }

  db.isDraining = false

  return flushPromise
}

export const startDrain = (db: DbClient) => {
  db.isDraining = true
  process.nextTick(() => {
    flushBuffer(db)
  })
}
