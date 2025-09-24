import { DbClient } from '../../index.js'
import { Ctx } from './Ctx.js'
import { rejectTmp, resolveTmp } from './Tmp.js'

export const reset = (ctx: Ctx) => {
  ctx.index = 8
  ctx.max = ctx.array.buffer.maxByteLength - 4
  ctx.size = ctx.array.buffer.byteLength - 4
  ctx.cursor = {}
  ctx.batch = {}
}

export const cancel = (ctx: Ctx, error: Error) => {
  const { batch } = ctx
  reset(ctx)
  batch.error = error
  batch.promises?.forEach(rejectTmp)
}

export const consume = (ctx: Ctx): Uint8Array => {
  if (ctx.index > ctx.array.byteLength) {
    throw new Error('Invalid size - modify buffer length mismatch')
  }
  const payload = ctx.array.subarray(0, ctx.index)
  reset(ctx)
  return payload
}

export const drain = (db: DbClient, ctx: Ctx) => {
  if (ctx.index > 8) {
    const { batch } = ctx
    const payload = consume(ctx)
    ctx.draining = db.hooks
      .flushModify(payload)
      .then((res) => {
        if (res === null) {
          throw Error('Schema mismatch')
        }
        batch.res = res
      })
      .catch((e) => {
        batch.error = e
      })
      .finally(() => {
        batch.ready = true
        batch.promises?.forEach(batch.error ? rejectTmp : resolveTmp)
        batch.promises = null
      })
  }
  return ctx.draining
}

export const schedule = (db: DbClient, ctx: Ctx) => {
  if (ctx.scheduled || ctx.index === 8) {
    return ctx.scheduled
  }
  ctx.scheduled = new Promise<void>((resolve) => {
    if (db.flushTime === 0) {
      process.nextTick(() => {
        ctx.scheduled = null
        resolve(drain(db, ctx))
      })
    } else {
      setTimeout(() => {
        ctx.scheduled = null
        resolve(drain(db, ctx))
      }, db.flushTime)
    }
  })
}
