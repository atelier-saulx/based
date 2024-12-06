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

  const transferList = new Array(1)
  const handleMsg = (msg) => {
    const arrayBuf = native.getQueryBuf(msg, dbCtx).buffer
    transferList[0] = arrayBuf
    channel.postMessage(arrayBuf, transferList)
  }

  channel.on('message', handleMsg)

  const msg = receiveMessageOnPort(channel)
  if (msg) {
    handleMsg(msg.message)
  }
}
