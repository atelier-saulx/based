import { readUint8, decodeName } from '../../../protocol'
import { BasedServer } from '../../server'
import { BasedErrorCode } from '../../../error'
import { sendError } from '../../sendError'
import { WebsocketClient, isObservableFunctionSpec } from '../../../types'
import { sendWsFunction } from '../../worker'

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

  const p = arr.slice(start + 8 + nameLen, start + len)

  server.functions
    .install(name)
    .then((spec) => {
      if (!client.ws) {
        return
      }
      if (spec && !isObservableFunctionSpec(spec)) {
        sendWsFunction(
          server,
          {
            authState: client.ws.authState,
            query: client.ws.query,
            ua: client.ws.ua,
            ip: client.ws.ip,
            headers: client.ws.headers,
          },
          spec,
          reqId,
          isDeflate,
          p
        )
          .then(async (v) => {
            client.ws?.send(v, true, false)
          })
          .catch((err) => {
            sendError(server, client, err.code, {
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