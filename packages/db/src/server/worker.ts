import {
  isMainThread,
  receiveMessageOnPort,
  workerData,
} from 'node:worker_threads'
import native from '../native.js'

if (isMainThread) {
  console.warn('running worker.ts in mainthread')
} else {
  const { address, channel } = workerData
  const dbCtx = native.externalFromInt(address)

  native.workerCtxInit()

  const handleMsg = (msg) => {
    channel.postMessage(native.getQueryBuf(msg, dbCtx))
  }

  channel.on('message', handleMsg)

  const msg = receiveMessageOnPort(channel)
  if (msg) {
    handleMsg(msg.message)
  }
}
