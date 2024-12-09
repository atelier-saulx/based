import { BasedDb } from '../index.js'
import { PropDef } from '../server/schema/types.js'

export class ModifyCtx {
  constructor(db: BasedDb, offset = 0, size = ~~(db.maxModifySize / 2)) {
    this.offset = offset
    this.len = offset
    this.size = size
    this.max = offset + size - 8
    this.db = db

    if (db.modifyCtx) {
      this.buf = db.modifyCtx.buf
    } else {
      this.buf = Buffer.from(new SharedArrayBuffer(db.maxModifySize))
      db.modifyCtx = this
    }
  }

  // default values
  id = -1
  lastMain = -1
  hasStringField = -1
  queue = new Map<(payload: any) => void, any>()
  ctx: { offset?: number } = {} // maybe make this different?

  detached: boolean
  payload: Buffer
  queued: boolean

  offset: number
  len: number

  max: number
  size: number
  state: Int32Array
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
    db.modifyCtx = new ModifyCtx(db, 0, db.maxModifySize)
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
