import { writeUint16, writeUint32 } from '@based/utils'
import { DbClient } from '../../index.js'
import { Ctx } from './Ctx.js'
import { rejectTmp, resolveTmp } from './Tmp.js'
import { reserve } from './resize.js'

let test = 0
export const reset = (ctx: Ctx) => {
  ctx.index = 8
  ctx.max = ctx.array.buffer.maxByteLength - 4
  ctx.cursor = {}
  ctx.created = {}
  test++
  // @ts-ignore
  ctx.batch = { test }
}

export const cancel = (ctx: Ctx, error: Error) => {
  const { batch } = ctx
  reset(ctx)
  batch.error = error
  batch.promises?.forEach(rejectTmp)
}

export const consume = (ctx: Ctx) => {
  if (ctx.index > ctx.array.byteLength) {
    throw new Error('Invalid size - modify buffer length mismatch')
  }

  const typeIds = Object.keys(ctx.created)
  const typeSize = typeIds.length * 6 + 4
  reserve(ctx, typeSize)
  const payload = ctx.array.subarray(0, ctx.index + typeSize)
  let i = payload.byteLength - 4
  writeUint32(payload, ctx.index, i)
  for (const typeId of typeIds) {
    const count = ctx.created[typeId]
    i -= 6
    writeUint16(payload, Number(typeId), i)
    writeUint32(payload, count, i + 2)
  }

  reset(ctx)

  return payload
}
let cnt = 0
export const drain = (db: DbClient, ctx: Ctx) => {
  if (ctx.index > 8) {
    const { batch } = ctx
    const payload = consume(ctx)
    ctx.draining = db.hooks
      .flushModify(payload)
      .then(({ offsets, dbWriteTime }) => {
        db.writeTime += dbWriteTime ?? 0
        batch.ready = true
        batch.offsets = offsets
        batch.promises?.forEach(resolveTmp)
        batch.promises = null
      })
      .catch(console.error)
  }
  return ctx.draining
}

export const schedule = (db: DbClient, ctx: Ctx) => {
  // return drain(db, ctx)
  if (ctx.scheduled || ctx.index === 8) {
    return
  }
  ctx.scheduled = true
  return new Promise<void>((resolve) => {
    if (db.flushTime === 0) {
      process.nextTick(async () => {
        ctx.scheduled = false
        await drain(db, ctx)
        resolve()
      })
    } else {
      setTimeout(async () => {
        ctx.scheduled = false
        await drain(db, ctx)
        resolve()
      }, db.flushTime)
    }
  })
}
