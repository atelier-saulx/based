import { isMainThread, parentPort, workerData } from 'node:worker_threads'
import { nextTick } from 'node:process'
import native from '../../native.js'

let dbCtx: any
let wCtx: any // This must be held until the worker exits otherwise the ctx will be autofreed instantly

if (isMainThread) {
  console.warn(`running a worker in the mainthread - incorrect`)
} else if (workerData?.isDbWorker) {
  let { address } = workerData
  dbCtx = native.externalFromInt(address)
  wCtx = native.workerCtxInit()
} else {
  console.info('incorrect worker db query')
}

export function registerMsgHandler(
  onMsg: (
    dbCtx: any,
    msg: any,
  ) => Uint8Array<ArrayBufferLike> | ArrayBuffer | null,
) {
  if (!workerData?.isDbWorker) {
    throw new Error('Not a DbWorker')
  }

  let { channel } = workerData
  const handleMsg = (msg: any) => {
    try {
      if (typeof msg === 'bigint') {
        if (msg === 0n) {
          // terminate
          nextTick(() => typeof self === 'undefined' ? process.exit() : self.close())
          channel.postMessage(null)
        } else {
          // it's a ctx address
          dbCtx = native.externalFromInt(msg)
          channel.postMessage(null)
        }
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
