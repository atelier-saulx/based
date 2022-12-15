import { readUint8, decodeName, decodePayload } from '../../protocol'
import { BasedServer } from '../../server'
import { BasedErrorCode } from '../../error'
import { sendError } from '../../sendError'
import { isObservableFunctionSpec } from '../../functions'
import { WebsocketClient } from '../../client'

export const functionMessage = (
  arr: Uint8Array,
  start: number,
  len: number,
  isDeflate: boolean,
  client: WebsocketClient,
  server: BasedServer
): boolean => {
  // | 4 header | 3 id | 1 name length | * name | * payload |

  const requestId = readUint8(arr, start + 4, 3)
  const nameLen = arr[start + 7]
  const name = decodeName(arr, start + 8, start + 8 + nameLen)

  if (!name || !requestId) {
    return false
  }

  const route = server.functions.route(name)

  if (!route) {
    sendError(server, client, BasedErrorCode.FunctionNotFound, {
      name,
      requestId,
    })
    return false
  }

  if (route.observable === true) {
    sendError(server, client, BasedErrorCode.FunctionIsObservable, {
      name,
      requestId,
    })
    return false
  }

  if (len > route.maxPayloadSize) {
    sendError(server, client, BasedErrorCode.PayloadTooLarge, {
      name,
      requestId,
    })
    return false
  }

  if (route.stream === true) {
    sendError(server, client, BasedErrorCode.FunctionIsStream, {
      name,
      requestId,
    })
    return true
  }

  const payload = decodePayload(
    new Uint8Array(arr.slice(start + 8 + nameLen, start + len)),
    isDeflate
  )

  // make this fn a bit nicer....
  server.auth
    .authorize(client.ws, name, payload)
    .then((ok) => {
      if (!client.ws) {
        return false
      }

      if (!ok) {
        sendError(server, client, BasedErrorCode.AuthorizeRejectedError, {
          route,
        })
        return false
      }

      server.functions
        .install(name)
        .then((spec) => {
          if (!client.ws) {
            return
          }
          if (spec && !isObservableFunctionSpec(spec)) {
            spec
              .function(payload, client.ws)
              .then(async (v) => {
                client.ws?.send(v, true, false)
              })
              .catch((err) => {
                sendError(server, client, err.code, {
                  route,
                  requestId,
                  err,
                })
              })
          }
        })
        .catch(() =>
          sendError(server, client, BasedErrorCode.FunctionNotFound, {
            name,
            requestId,
          })
        )
    })
    .catch((err) => {
      sendError(server, client, BasedErrorCode.AuthorizeFunctionError, {
        route,
        err,
      })
    })

  return true
}
