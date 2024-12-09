import { BasedDb } from '../index.js'
import { PropDef } from '../server/schema/types.js'

export class ModifyCtx {
  constructor(db: BasedDb) {
    this.max = db.maxModifySize
    this.db = db

    if (db.modifyCtx) {
      this.buf = db.modifyCtx.buf
    } else {
      this.buf = Buffer.allocUnsafe(db.maxModifySize)
      db.modifyCtx = this
    }
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
  prefix0: number
  prefix1: number

  mergeMain: (PropDef | any)[] | null
  mergeMainSize: number

  db: BasedDb
}

export const flushBuffer = (db: BasedDb) => {
  const ctx = db.modifyCtx

  if (ctx.len) {
    const d = Date.now()
    try {
      db.server.modify(ctx.buf.subarray(0, ctx.len))
    } catch (e) {
      console.error(e)
    }
    db.writeTime += Date.now() - d
    db.modifyCtx = new ModifyCtx(db)
    if (ctx.queue.size) {
      for (const [resolve, payload] of ctx.queue) {
        resolve(payload)
      }
    }
  }

  db.isDraining = false
}

export const startDrain = (db: BasedDb) => {
  db.isDraining = true
  process.nextTick(() => {
    flushBuffer(db)
  })
}
