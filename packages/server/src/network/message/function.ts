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

  // make this shared - remove authorize form ehre
  // content ecndoing will be set and send as well
  // const payload = decodePayload(
  //   new Uint8Array(arr.slice(start + 8 + nameLen, start + len)),
  //   isDeflate
  // )

  if (!name || !reqId) {
    return false
  }

  const route = server.functions.route(name)

  if (!route || route.observable === true || route.stream === true) {
    // stream not with ws for now...
    return false
  }

  if (len > route.maxPayloadSize) {
    sendError(server, client, BasedErrorCode.PayloadTooLarge, route)
    return false
  }

  const sharedBuf = new SharedArrayBuffer(len - (start + 8 + nameLen))

  const a = new Uint8Array(sharedBuf)

  a.set(arr.slice(start + 8 + nameLen, start + len), 0)

  console.log('yes', a)

  server.functions
    .install(name)
    .then((spec) => {
      if (!client.ws) {
        return
      }

      if (spec && !isObservableFunctionSpec(spec)) {
        server.functions
          .runFunction(spec, client, a)
          .then(async (v) => {
            // can allready be buffer from the function (in this case)
            client.ws?.send(
              encodeFunctionResponse(reqId, valueToBuffer(v)),
              true,
              false
            )
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

  return true
}
