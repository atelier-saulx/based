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
  ctx.batch.error = error
  ctx.batch.promises?.forEach(rejectTmp)
  reset(ctx)
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
    const testCnt = cnt++
    // console.log('drain:', ctx.index, testCnt, ctx.batch)
    const { batch } = ctx
    const payload = consume(ctx)
    // console.log({ payload })
    ctx.draining = db.hooks
      .flushModify(payload)
      .then(({ offsets, dbWriteTime }) => {
        // console.log('done:', testCnt, batch)
        db.writeTime += dbWriteTime ?? 0
        batch.ready = true
        batch.offsets = offsets
        batch.promises?.forEach(resolveTmp)
        batch.promises = null
      })
      .catch(console.error)
      .finally(() => {
        ctx.draining = null
        return drain(db, ctx)
      })
    return ctx.draining
  }
}

export const schedule = (db: DbClient, ctx: Ctx) => {
  drain(db, ctx)
  // if (ctx.scheduled || ctx.index === 8) {
  //   return
  // }
  // ctx.scheduled = true
  // return new Promise<void>((resolve) => {
  //   if (db.flushTime === 0) {
  //     process.nextTick(() => {
  //       drain(db, ctx)
  //       resolve()
  //       ctx.scheduled = false
  //     })
  //   } else {
  //     setTimeout(() => {
  //       drain(db, ctx)
  //       resolve()
  //       ctx.scheduled = false
  //     }, db.flushTime)
  //   }
  // })
}
