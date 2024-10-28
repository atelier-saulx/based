# workers

```ts
create()

// next tick

drain()

const drain = (db) => {
  const handler = selectHandler(db)
  const ctx = db.ctx

  handler.modify(ctx)

  if (ctx.pos - ctx.start > ctx.end - ctx.pos) {
    // start from beginning, until start of this run
    ctx.start = 0
    ctx.pos = 0
    ctx.end = smallestPos(db)
  } else {
    // continue
    ctx.start = ctx.end
    ctx.pos = ctx.end
    ctx.end = nextPos(db, ctx.start)
  }

  // clear the rest of the ctx
  // make sure to set new queue
}

const selectHandler = (db) => {
  const types = db.ctx.types
  let free
  let chillest

  for (const type of types) {
    for (const worker of db.workers) {
      if (worker.processing) {
        if (worker.processing.has(type)) {
          return worker
        }
        if (free) {
          continue
        }
        if (!chillest || chillest.remaining() > worker.remaining()) {
          chillest = worker
        }
      } else {
        free = worker
      }
    }
  }

  return free || chillest
}

const smallestPos = (db) => {
  let smallestPos = 0
  for (const worker of db.workers) {
    if (worker.processing) {
      const pos = worker.pos()
      if (!smallesPos || pos < smallestPos) {
        smallestPos = pos
      }
    }
  }
  return smallestPos
}

const nextPos = (db, from) => {
  let nextPos = db.maxModifySize
  for (const worker of db.workers) {
    if (worker.processing) {
      const pos = worker.pos()
      if (pos > from && pos < nextPos) {
        nextPos = pos
      }
    }
  }
  return nextPos
}

class DbWorker {
  async modify(ctx) {
    const { start, end, queue, types } = ctx

    this.processing = types
    this.modifyState[0] = start
    this.modifyState[1] = end
    this.modifyState[2] = 1 // start

    Atomics.notify(this.modifyState, 2, 1)
    await Atomics.waitAsync(this.modifyState, 2, 0)

    for (const [tmpId, resolve] of queue) {
      resolve(tmpId)
    }

    if (ctx.end === start) {
      ctx.end = end
    }

    this.processing = null
  }

  pos() {
    return this.modifyState[0]
  }

  remaining() {
    return this.modifyState[1] - this.modifyState[0]
  }
}
```

worker

```ts
const { modifyBuffer, modifyState } = workerData
const buffer = Buffer.from(modifyBuffer)

const modify = () => {
  Atomics.wait(modifyState, 2, 1)
  const start = modifyState[0]
  const end = modifyState[0]
  const slice = buffer.subarray(start, end)

  native.modify(slice, dbCtx, modifyState)
  modifyState[2] = 0 // done
  Atomics.notify(modifyState, 2, 1)
  modify()
}

modify()
```
