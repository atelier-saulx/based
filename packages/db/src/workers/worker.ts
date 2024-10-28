import {
  isMainThread,
  workerData,
  receiveMessageOnPort,
} from 'node:worker_threads'
import { native } from '../index.js'

if (isMainThread) {
  console.warn('this is wrong, running worker.ts in mainthread')
} else {
  const { address, channel, atomics } = workerData
  const notify = new Int32Array(atomics)
  const state = new Uint32Array(atomics)
  const dbCtx = native.externalFromInt(address)
  const modify = (buf) => {
    native.modify(buf, dbCtx, state)
    channel.postMessage(0)
  }

  const get = (buf) => {
    const result = native.getQueryBuf(buf, dbCtx)
    channel.postMessage(result.buffer, [result.buffer])
  }

  channel.postMessage(0)
  while (true) {
    Atomics.wait(notify, 1, 0)
    let msg
    while ((msg = receiveMessageOnPort(channel))) {
      console.log('incoming msg:', msg)
      if (msg.message[0] === 1) {
        modify(msg.message[1])
      } else {
        // get(payload)
      }
    }
  }

  // poll()
}
