import { writeUint16, writeUint32 } from '@based/utils'
import { DbClient } from '../../index.js'
import { Ctx } from './Ctx.js'

export const consume = (ctx: Ctx) => {
  const typeIds = Object.keys(ctx.created)
  const payload = ctx.array.subarray(0, ctx.index + typeIds.length * 6 + 4)
  let i = payload.byteLength - 4
  writeUint32(payload, ctx.index, i)
  for (const typeId of typeIds) {
    const count = ctx.created[typeId]
    i -= 6
    writeUint16(payload, Number(typeId), i)
    writeUint32(payload, count, i + 2)
  }
  ctx.index = 8
  ctx.current = {}
  ctx.created = {}
  return payload
}

export const drain = (db: DbClient, ctx: Ctx) => {
  if (ctx.index > 8) {
    const payload = consume(ctx)
    ctx.draining = db.hooks
      .flushModify(payload)
      .then(({ offsets, dbWriteTime }) => {
        db.writeTime += dbWriteTime ?? 0
        console.log({ offsets })
      })
      .catch(console.error)
      .finally(() => {
        ctx.draining = null
      })
    return ctx.draining
  }
}

export const scheduleDrain = (db: DbClient, ctx: Ctx) => {
  if (ctx.scheduled) {
    return
  }
  ctx.scheduled = true
  if (db.flushTime === 0) {
    process.nextTick(() => {
      ctx.scheduled = false
      drain(db, ctx)
    })
  } else {
    setTimeout(() => {
      ctx.scheduled = false
      drain(db, ctx)
    }, db.flushTime)
  }
}
