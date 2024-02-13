import { BasedClient } from '../index.js'
import { addStreamChunk, addStreamRegister } from '../outgoing/index.js'

export const startStream = (
  client: BasedClient,
  fnName: string,
  opts: {
    size: number
    fileName: string
    mimeType: string
    payload?: any
  }
) => {
  let reqId = ++client.streamRequestId

  if (reqId > 16777215) {
    reqId = 0
  }

  let seqId = 0

  addStreamRegister(
    client,
    reqId,
    opts.size,
    opts.fileName,
    opts.mimeType,
    fnName,
    opts.payload
  )

  //   addStreamChunk()

  // will use a strem for noe

  //     addStreamRegister(
  //       this,
  //       reqId,
  //       opts.size,
  //       opts.fileName,
  //       opts.mimeType,
  //       name,
  //       opts.payload
  //     )

  //     opts.contents.on('data', (chunk) => {
  //       addStreamChunk(this, reqId, ++seqId, chunk)
  //     })

  // this can be done on top...
  return new Promise((resolve, reject) => {
    client.streamFunctionResponseListeners.set(reqId, [resolve, reject])
  })
}
