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

------------------ NEW PLAN ----------------------

main

```ts
class BatchCtx {
    constructor (db) {
      if (db.processing.length) {
        const processing = []
        // find the best location for a new batch ctx
        let maxRange = 0
        let prevEnd = 0
        let bestStart

        for (const ctx of db.processing) {
          const done = ctx.state[1]
          if (done) {
            continue
          }

          const cursor = ctx.state[0]
          const start = ctx.offset + cursor
          const range = start - prevEnd

          if (range > maxRange) {
            maxRange = range
            bestStart = start
          }
          // push batches that are still in progress
          processing.push(ctx)
        }

        db.processing = processing

        this.min = bestStart
        this.len = bestStart
        this.max = bestStart + maxRange - 2 // for state
      } else {
        this.min = 0
        this.len = 0
        this.max = db.maxModifySize - 2 // for state
      }
    }
}


const drain = (ctx) => {
  const required = ctx.modifySize / 2 // can adjust this
  const size = ctx.len - ctx.min

}


class ModifyBatch {
  constructor (ctx) {
    const size = ctx.len - ctx.min
    const left = ctx.modifySize - size
    const required = ctx.modifySize / 2 // can adjust this

    this.min = ctx.min
    this.max = ctx.max + 2 // for state

    let payload = ctx.buf.subarray(ctx.min, ctx.len)
    let state = ctx.buf.subarray(ctx.len, this.max)

    state[0] = 0
    state[1] = 0

    if (left < required) {
      // do a copy
      payload = Buffer.from(payload)
      state = Buffer.from(state)
    }

    const worker = selectWorker(ctx)

    worker.channel.postMessage([0, payload, state])

    if (ctx.queue.size) {
      const queue = ctx.queue
      Atomics.asyncWait(state, 1, 0).then(() => {
        // handle queue
      })
    }
  }
  min,
  max,
  state,
}

class DbWorker {}

const drain = (db) => {
  const ctx = db.modifyCtx
  if (ctx.types.size) {
    // first run
    if (!ctx.processing) {
      const batch = new ModifyBatch(ctx)

    }







    // clean up
    for (const batch of ctx.processing) {
      const done = batch.state[1]
      if (done) {
        if (batch.start === ) {

        }
      }
    }
    // for (let i = 0; i < db.processing.length; i++) {
    //     const { start, end, state } = db.processing[i]
    //     if (state[1] === 1) {
    //       if (ctx.max < end) {
    //         ctx.max = end
    //       }
    //     }
    //   }

    // }

    db.processing = db.processing.filter(({ start, end, state }) => {
      if (state[1] === 1) {
        // its done!
        if (ctx.max === start) {
          ctx.max = end
        }
        return false
      }
      if (ctx.max === start) {
        ctx.max = state[0]
      }
      return true
    })
  }
}
```

worker

```ts
const { address, channel } = workerData
const dbCtx = getFromAddress(address)
const poll = () => {
  const msg = receiveMessageOnPort(channel)
  if (msg) {
    if (msg.message[0] === 0) {
      // modify
      const payload = msg.message[1]
      const state = msg.message[2]
      // native will update the state
      native.modify(payload, dbCtx, state)
      // it's done!
      state[1] = 1
    }
  }
  process.nextTick(poll)
}
```
