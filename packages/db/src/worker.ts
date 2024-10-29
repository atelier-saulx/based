import {
  isMainThread,
  receiveMessageOnPort,
  workerData,
} from 'node:worker_threads'
import { native } from './index.js'

if (isMainThread) {
  console.warn('this is wrong, running worker.ts in mainthread')
} else {
  const { address, channel, atomics } = workerData
  const dbCtx = native.externalFromInt(address)

  channel.postMessage(0) // tell parent we are ready

  const next = () => {
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
        Atomics.notify(state, 1, 1)
      }
      process.nextTick(next)
    } else {
      atomics[0] = 0
      Atomics.wait(atomics, 0, 0)
      next()
    }
  }

  next()
}
