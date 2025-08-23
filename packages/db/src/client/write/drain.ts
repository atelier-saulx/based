import { writeUint16, writeUint32 } from '@based/utils'
import { DbClient } from '../../index.js'
import { Ctx } from './Ctx.js'

export const drain = (db: DbClient, ctx: Ctx) => {
  if (ctx.index > 8) {
    const payload = ctx.array.subarray(0, ctx.index + ctx.created.size * 6 + 4)
    let pos = payload.byteLength - 4
    writeUint32(payload, ctx.index, pos)
    for (const [typeId, initId] of ctx.created) {
      pos -= 6
      writeUint16(payload, typeId, pos)
      writeUint32(payload, initId, pos)
    }
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
