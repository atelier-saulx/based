import { BasedDb } from './index.js'

let j = 0

export const flushBuffer = (db: BasedDb) => {
  const ctx = db.modifyCtx
  if (ctx.len) {
    const queue = ctx.queue
    const d = Date.now()
    const offset = 0
    let start = 0

    console.log(ctx.len, ctx.types)
    // // TODO put actual offset here
    // console.log(
    //   '----- start drain',
    //   ctx.types.map((type) => {
    //     type.modifyIndex = null
    //     return type.type
    //   }),
    // )

    try {
      // const worker = db.workers[0]
      // const end = ctx.len

      // worker.modify(ctx.buf.subarray(start, ctx.len))
      // worker.start = start
      // worker.end = end

      // if (ctx.len >= ctx.max) {
      //   // restart
      //   ctx.len = 0
      // }

      //   // TODO make this way smarter!!!
      //   if (db.workers.length) {
      //     for (let i = 0; i < ctx.types.length; i++) {
      //       const type = ctx.types[i]
      //       const next = ctx.types[i + 1]
      //       const typeStart = type.modifyIndex
      //       const typeEnd = next ? next.modifyIndex : ctx.len

      //       // @ts-ignore
      //       if (type.worker) {
      //         console.log('existing worker:', { typeStart, typeEnd })
      //         // @ts-ignore
      //         type.worker.modify(ctx.buf.subarray(typeStart, typeEnd))
      //         start = typeEnd
      //       } else if (typeStart !== typeEnd) {
      //         console.log('new worker:', type.type, { typeStart, typeEnd })
      //         const worker = db.workers[j++ % db.workers.length]
      //         // @ts-ignore
      //         type.worker = worker
      //         worker.modify(ctx.buf.subarray(typeStart, typeEnd))
      //         start = typeEnd
      //       }

      //       type.modifyIndex = null
      //     }
      //   }

      // if (start === ctx.len) {
      //   console.info('hmmm ok everything is on worker now...')
      // } else {
      //
      // }

      db.native.modify(
        ctx.buf.subarray(0, ctx.len),
        db.dbCtxExternal,
        ctx.state,
      )
      // or it sends it to the actual db
    } catch (err) {
      console.error(err)
    }

    // add errors and reset them here
    ctx.len = 0
    ctx.prefix0 = 0
    ctx.prefix1 = 0
    ctx.field = -1
    ctx.id = -1
    ctx.lastMain = -1
    ctx.mergeMain = null
    ctx.mergeMainSize = 0
    ctx.hasStringField = -1
    ctx.ctx.offset = offset
    ctx.ctx = {}
    ctx.types.clear()

    const time = Date.now() - d
    console.log({ time })
    db.writeTime += time
    db.isDraining = false

    if (queue.size) {
      for (const [tmpId, resolve] of queue) {
        resolve(tmpId + offset)
      }
      queue.clear()
    }

    return time
  }

  db.isDraining = false
  return 0
}

export const startDrain = (db: BasedDb) => {
  db.isDraining = true
  process.nextTick(() => {
    flushBuffer(db)
  })
}
