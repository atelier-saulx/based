import { isMainThread, parentPort, workerData } from 'node:worker_threads'
import native from '../native.js'

let dbCtx: any

if (isMainThread) {
  console.warn(`running a worker in the mainthread - incorrect`)
} else if (workerData?.isDbWorker) {
  let { address } = workerData
  dbCtx = native.externalFromInt(address)
  native.workerCtxInit()
} else {
  console.info('incorrect worker db query')
}

export function registerMsgHandler(onMsg: (dbCtx: any, msg: any) => ArrayBuffer | null) {
  if (!workerData?.isDbWorker) {
    throw new Error('Not a DbWorker')
  }

  let { channel } = workerData
  const handleMsg = (msg: any) => {
    try {
      if (typeof msg === 'bigint') {
        // it's a ctx address
        dbCtx = native.externalFromInt(msg)
        channel.postMessage(null)
      } else {
        // a message to the worker handler
        const arrayBuf = onMsg(dbCtx, msg)
        channel.postMessage(arrayBuf, [arrayBuf])
      }
    } catch (e) {
      channel.postMessage(e)
    }
  }

  channel.on('message', handleMsg)
  parentPort.postMessage('READY')
}
