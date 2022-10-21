import { isObservableFunctionSpec } from '../../functions'
import {
  readUint8,
  valueToBuffer,
  encodeFunctionResponse,
  // decodePayload,
  decodeName,
} from '../../protocol'
import { BasedServer } from '../../server'
import { BasedErrorCode } from '../../error'
import { sendError } from './send'
import { WebsocketClient } from '../../types'

const processFunction = () => {}

export const functionMessage = (
  arr: Uint8Array,
  start: number,
  len: number,
  isDeflate: boolean,
  client: WebsocketClient,
  server: BasedServer
): boolean => {
  // | 4 header | 3 id | 1 name length | * name | * payload |

  const reqId = readUint8(arr, start + 4, 3)
  const nameLen = arr[start + 7]
  const name = decodeName(arr, start + 8, start + 8 + nameLen)

  if (!name || !reqId) {
    return false
  }

  const route = server.functions.route(name)

  if (!route) {
    sendError(server, client, BasedErrorCode.FunctionNotFound, { name })
    return false
  }

  if (route.observable === true) {
    sendError(server, client, BasedErrorCode.FunctionIsObservable, route)
    return false
  }

  if (len > route.maxPayloadSize) {
    sendError(server, client, BasedErrorCode.PayloadTooLarge, route)
    return false
  }

  if (route.stream === true) {
    sendError(server, client, BasedErrorCode.FunctionIsStream, route)
    return true
  }

  const pLen = len - (8 + nameLen)

  global.gc()
  const m1 = process.memoryUsage() // Initial usage
  const d = Date.now()

  // const sharedBuf = new SharedArrayBuffer(pLen)

  // const a = new Uint8Array(sharedBuf)

  // const nB = arr.slice(start + 8 + nameLen, start + len)

  // const s = start + 8 + nameLen
  // const e = start + len
  // for (let i = s; i < e; i++) {
  //   a[i - s] = arr[i]
  // }

  const p = arr.slice(start + 8 + nameLen, start + len)

  // const x = arr.slice(start + 8 + nameLen, start + len)

  // a.set(x, 0)
  global.gc()

  const m2 = process.memoryUsage()
  console.info('----------------------------------------')
  console.info('INCOMING SIZE', len)
  console.info('SPEED', Date.now() - d, 'ms')
  console.info(
    `Memory: ${
      Math.round(((m2.heapUsed - m1.heapUsed) / 1024 / 1024) * 100) / 100
    } MB`,

    `Total Memory: ${Math.round((m2.heapUsed / 1024 / 1024) * 100) / 100} MB`
  )

  server.functions
    .install(name)
    .then((spec) => {
      if (!client.ws) {
        return
      }
      if (spec && !isObservableFunctionSpec(spec)) {
        // optimize format of client
        server.functions
          .runFunction(spec, client, p, isDeflate, reqId)
          .then(async (v) => {
            console.info('----------------------------------------')
            console.info('response', v)
            // can allready be buffer from the function (in this case)

            global.gc()
            const m2 = process.memoryUsage() // Initial usage
            console.info(
              `Total Memory: ${
                Math.round((m2.heapUsed / 1024 / 1024) * 100) / 100
              } MB`
            )
            client.ws?.send(v, true, false)
          })
          .catch((err) => {
            sendError(server, client, BasedErrorCode.FunctionError, {
              route,
              requestId: reqId,
              err,
            })
          })
      }
    })
    .catch(() =>
      sendError(server, client, BasedErrorCode.FunctionNotFound, route)
    )

  return true
}

// sharedBuf

// authorize has to go from here (scince we dont parse the payload yet)
// server.auth.config
//   .authorize(server, client, name, payload)
//   .then((ok) => {
//     if (!ok) {
//       sendError(server, client, BasedErrorCode.AuthorizeRejectedError, route)
//       return false
//     }

//     server.functions
//       .install(name)
//       .then((spec) => {
//         if (spec && !isObservableFunctionSpec(spec)) {
//           spec
//             .function(payload, client)
//             .then((v) => {
//               client.ws?.send(
//                 encodeFunctionResponse(reqId, valueToBuffer(v)),
//                 true,
//                 false
//               )
//             })
//             .catch((err) => {
//               sendError(server, client, BasedErrorCode.FunctionError, {
//                 route,
//                 requestId: reqId,
//                 err,
//               })
//             })
//         } else {
//           sendError(server, client, BasedErrorCode.FunctionNotFound, route)
//         }
//       })
//       .catch(() => {
//         sendError(server, client, BasedErrorCode.FunctionNotFound, route)
//       })
//   })
//   .catch((err) => {
//     sendError(server, client, BasedErrorCode.AuthorizeFunctionError, {
//       route,
//       requestId: reqId,
//       err,
//     })
//     return false
//   })
