import {
  isMainThread,
  receiveMessageOnPort,
  workerData,
} from 'node:worker_threads'
import native from '../native.js'

if (isMainThread) {
  console.warn('running query worker.ts in mainthread - incorrect')
} else if (workerData?.isDbWorker) {
  let { address, channel } = workerData
  let dbCtx = native.externalFromInt(address)

  native.workerCtxInit()

  // const transferList = new Array(1)
  const handleMsg = (msg) => {
    try {
      if (typeof msg === 'bigint') {
        // it's a ctx address
        address = msg
        dbCtx = native.externalFromInt(address)
        channel.postMessage(null)
      } else {
        const arrayBuf = native.getQueryBuf(msg, dbCtx)
        // transferList[0] = arrayBuf
        channel.postMessage(arrayBuf, [arrayBuf])
      }
    } catch (e) {
      channel.postMessage(e)
    }
  }

  channel.on('message', handleMsg)

  const msg = receiveMessageOnPort(channel)
  if (msg) {
    handleMsg(msg.message)
  }
} else {
  console.info('incorrect worker db query')
}
