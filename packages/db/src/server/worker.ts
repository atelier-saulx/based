import { isMainThread, parentPort, workerData } from 'node:worker_threads'
import native from '../native.js'

if (isMainThread) {
  console.warn('running query worker.ts in mainthread - incorrect')
} else if (workerData?.isDbWorker) {
  let { address, channel } = workerData
  let dbCtx = native.externalFromInt(address)
  native.workerCtxInit()
  const handleMsg = (msg) => {
    try {
      if (typeof msg === 'bigint') {
        // it's a ctx address
        address = msg
        dbCtx = native.externalFromInt(address)
        channel.postMessage(null)
      } else {
        const arrayBuf = native.getQueryBuf(msg, dbCtx)
        channel.postMessage(arrayBuf, [arrayBuf])
      }
    } catch (e) {
      channel.postMessage(e)
    }
  }
  channel.on('message', handleMsg)
  parentPort.postMessage('READY')
} else {
  console.info('incorrect worker db query')
}
