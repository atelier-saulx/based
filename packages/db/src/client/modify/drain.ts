import { writeUint32 } from '@based/utils'
import { DbClient } from '../../index.js'
import { Ctx, MODIFY_HEADER_SIZE } from './Ctx.js'
import { rejectTmp, resolveTmp } from './Tmp.js'

export const reset = (ctx: Ctx) => {
  ctx.reset()
}

export const cancel = (ctx: Ctx, error: Error) => {
  const { batch } = ctx
  reset(ctx)
  batch.error = error
  batch.promises?.forEach(rejectTmp)
}

export const consume = (ctx: Ctx): Uint8Array => {
  if (ctx.index > ctx.buf.byteLength) {
    throw new Error('Invalid size - modify buffer length mismatch')
  }
  const payload = ctx.buf.subarray(0, ctx.index)
  writeUint32(ctx.buf, ctx.batch.count ?? 0, 5 + 8)
  reset(ctx)
  return payload
}

export const drain = (db: DbClient, ctx: Ctx) => {
  if (ctx.index > MODIFY_HEADER_SIZE) {
    // TODO USE PACKED STRUCT HEADER
    const { batch } = ctx
    const payload = consume(ctx)
    let start: number
    const current = db.hooks
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
        if (batch.promises) {
          start = ctx.index
          batch.promises.forEach(batch.error ? rejectTmp : resolveTmp)
          batch.promises = undefined
        }
      })
      .then(() => {
        if (start && start !== ctx.index) {
          const next = drain(db, ctx)
          if (next !== current) {
            return next
          }
        }
      })
    ctx.draining = current
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
        ctx.scheduled = undefined
        resolve(drain(db, ctx))
      })
    } else {
      setTimeout(() => {
        ctx.scheduled = undefined
        resolve(drain(db, ctx))
      }, db.flushTime)
    }
  })
}
