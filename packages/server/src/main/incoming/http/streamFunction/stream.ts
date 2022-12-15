// import { sendStream } from '../../worker'
import { sendToWorker } from '../../../worker'
import { BasedFunctionRoute, HttpClient } from '../../../../types'
import { sendError, sendHttpError } from '../../../sendError'
import { BasedErrorCode } from '../../../../error'
import { BasedServer } from '../../../server'
import { IncomingType } from '../../../../worker/types'

const MAX_CHUNK_SIZE = 1024 * 1024 * 5 // 5mb

const SHARED_CHUNK_SIZE = 128 * 1024 // 128kb

export default (
  server: BasedServer,
  client: HttpClient,
  route: BasedFunctionRoute,
  payload?: any
): void => {
  console.info('go go go stream!', payload)

  // TMP make selection better in worker...

  // if size is smaller then 128kb just send the parsed payload

  // allready start accepting the stream and building it
  const data = new Uint8Array(new SharedArrayBuffer(SHARED_CHUNK_SIZE))
  const state = new Int32Array(new SharedArrayBuffer(32)) // 32bytes to fit in 1 int32 array (for atomics...)

  let lastIndex = 0

  client.res.onData((c, isLast) => {
    if (c.byteLength > MAX_CHUNK_SIZE) {
      sendError(server, client, BasedErrorCode.ChunkTooLarge, route)
      return
    }

    if (c.byteLength + lastIndex > SHARED_CHUNK_SIZE) {
      // now we do shit
      console.info('FULL DO SOMETHING')
    } else {
      data.set(new Uint8Array(c), lastIndex)
      lastIndex += c.byteLength
    }

    // do we wait until its full?

    if (isLast) {
      console.info('END')
      // lets use a shared state for more messages e.g. make a shared state of 128 bytes and allow 128 things to execute in paralel

      Atomics.store(state, 0, 1)
      Atomics.notify(state, 0)
    }
  })

  server.functions
    .install(route.name)
    .then((fn) => {
      if (fn) {
        const selectedWorker = server.functions.lowestWorker
        sendToWorker(selectedWorker, {
          type: IncomingType.Stream,
          context: client.context,
          name: route.name,
          path: fn.functionPath,
          data,
          state,
        })
      } else {
        sendHttpError(server, client, BasedErrorCode.FunctionNotFound, route)
      }
    })
    .catch(() => {
      sendHttpError(server, client, BasedErrorCode.FunctionNotFound, route)
    })
}
