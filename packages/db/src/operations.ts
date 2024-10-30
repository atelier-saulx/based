import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { BasedDb } from './index.js'
import { PropDef } from './schema/types.js'
import { Worker, MessageChannel, MessagePort } from 'node:worker_threads'
// this is just so ts builds it
import './worker.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

let workerId = 0
export class DbWorker {
  constructor(db: BasedDb) {
    const address = db.native.intFromExternal(db.dbCtxExternal)
    const { port1, port2 } = new MessageChannel()

    this.worker = new Worker(join(__dirname, 'worker.js'), {
      workerData: {
        atomics: this.atomics,
        address,
        channel: port2,
      },
      transferList: [port2],
    })

    this.channel = port1
  }

  atomics = new Int32Array(new SharedArrayBuffer(4))
  id = workerId++
  channel: MessagePort
  ctx: ModifyCtx
  remaining = 0
  types: Record<number, number> = {}
  worker: Worker
}

export const startWorker = (db): void => {
  const dbWorker = new DbWorker(db)
  dbWorker.channel.once('message', (code) => {
    if (code === 0) {
      console.info('db worker ready')
    } else {
      console.error('Something went wrong with the worker', code)
      dbWorker.worker.terminate()
    }
  })
  dbWorker.worker.on('exit', (code) => {
    console.log('worker exit with code:', code)
    db.workers = db.workers.filter((worker) => worker !== dbWorker)
  })
  db.workers.push(dbWorker)
}

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
  types = new Set<number>()
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

const findWorkersForTypes = (db: BasedDb, ctx: ModifyCtx) => {
  const workersForTypes: DbWorker[] = []
  let leastRemaining = Infinity
  let chillestWorker: DbWorker

  for (const worker of db.workers) {
    if (worker.remaining < leastRemaining) {
      leastRemaining = worker.remaining
      chillestWorker = worker
    }
    for (const type of ctx.types) {
      if (type in worker.types) {
        workersForTypes.push(worker)
        break
      }
    }
  }

  return workersForTypes.length ? workersForTypes : [chillestWorker]
}

const detachFromSharedBuffer = (ctx: ModifyCtx) => {
  ctx.payload = Buffer.from(ctx.payload)
  ctx.state = new Int32Array(new SharedArrayBuffer(8))
  ctx.detached = true
}

const writeToWorker = async (worker: DbWorker, ctx: ModifyCtx) => {
  ctx.queued = true

  worker.ctx = ctx
  worker.remaining += ctx.size

  for (const type of ctx.types) {
    worker.types[type] ??= 0
    worker.types[type]++
  }

  console.log(
    'write to worker',
    worker.id,
    ctx.db.workers
      .map(({ ctx: { offset, size, max, detached } = {}, id }) => ({
        id,
        detached,
        offset,
        size,
        max,
      }))
      .filter(({ size }) => size),
  )

  if (ctx.detached) {
    worker.channel.postMessage(
      [0, ctx.payload, ctx.state],
      [ctx.payload.buffer],
    )
  } else {
    worker.channel.postMessage([0, ctx.payload, ctx.state])
  }

  worker.atomics[0] = 1
  Atomics.notify(worker.atomics, 0, 1)

  await Atomics.waitAsync(ctx.state, 1, 0).value

  worker.remaining -= ctx.size
  for (const type of ctx.types) {
    if (--worker.types[type] === 0) {
      delete worker.types[type]
    }
  }

  if (ctx.queue.size) {
    for (const [resolve, payload] of ctx.queue) {
      resolve(payload)
    }
  }
}

const filterCompleted = ({ state }: ModifyCtx) => {
  const status = state?.[1]
  return status !== 1
}

const writeCtx = async (db: BasedDb, ctx: ModifyCtx) => {
  // update ctx
  // ctx.size =
  ctx.payload = ctx.buf.subarray(ctx.offset, ctx.len)
  ctx.state = new Int32Array(ctx.buf.buffer, (ctx.len + 3) & ~3, 2)
  ctx.size = (ctx.len - ctx.offset + 8 + 3) & ~3 // has to be aligned
  ctx.state.fill(0)

  // remove things that are done
  db.writing = db.writing.filter(filterCompleted)
  // current ctx goes to writing
  db.writing.push(ctx)
  db.writing.sort((a, b) => a.offset - b.offset)
  // find best location for next context
  let maxGap = 0
  let prevEnd
  let offset

  const minSize = 10000
  while (maxGap < minSize) {
    prevEnd = 0
    offset = 0

    for (const ctx of db.writing) {
      if (ctx.detached) {
        continue
      }
      const currentStart = ctx.offset + ctx.state[0]
      const currentEnd = ctx.offset + ctx.size
      if (currentStart > prevEnd) {
        const gap = currentStart - prevEnd
        if (gap > maxGap) {
          maxGap = gap
          offset = prevEnd
        }
      }
      prevEnd = currentEnd
    }

    // Check for gap after the last occupied region
    if (prevEnd < db.maxModifySize) {
      const gap = db.maxModifySize - prevEnd
      if (gap > maxGap) {
        maxGap = gap
        offset = prevEnd
      }
    }

    if (maxGap < minSize) {
      // clear some space
      for (const region of db.writing) {
        if (!region.queued && !region.detached) {
          detachFromSharedBuffer(region)
          break
        }
      }
    }
  }

  db.modifyCtx = new ModifyCtx(
    db,
    offset,
    Math.min(maxGap, ~~(db.maxModifySize / 2)),
  )

  let workers = findWorkersForTypes(db, ctx)

  while (workers.length > 1) {
    await new Promise((resolve) => {
      for (const worker of workers) {
        worker.ctx.queue.set(resolve, 0)
      }
    })
    workers = findWorkersForTypes(db, ctx)
  }

  return writeToWorker(workers[0], ctx)
}

let defaultState
export const flushBuffer = (db: BasedDb, cb?: any) => {
  const ctx = db.modifyCtx

  if (ctx.types.size) {
    if (db.workers.length) {
      writeCtx(db, ctx)
    } else {
      const d = Date.now()
      try {
        db.native.modify(
          ctx.buf.subarray(0, ctx.len),
          db.dbCtxExternal,
          (defaultState ??= new Int32Array(2)),
        )
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
  }

  db.isDraining = false

  if (cb) {
    let cnt = db.writing.length
    if (cnt === 0) {
      cb(0)
    } else {
      const d = Date.now()
      const fn = () => {
        if (--cnt === 0) {
          cb(Date.now() - d)
        }
      }
      for (const ctx of db.writing) {
        ctx.queue.set(fn, 0)
      }
    }
  }
}

export const startDrain = (db: BasedDb) => {
  db.isDraining = true
  process.nextTick(() => {
    flushBuffer(db)
  })
}
