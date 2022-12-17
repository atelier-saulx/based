import {
  readUint8,
  decodeName,
  decodePayload,
  encodeFunctionResponse,
  valueToBuffer,
} from '../../protocol'
import { BasedServer } from '../../server'
import { BasedErrorCode } from '../../error'
import { sendError } from '../../sendError'
import { isObservableFunctionSpec } from '../../functions'
import { WebSocketSession, Context } from '../../client'

export const functionMessage = (
  arr: Uint8Array,
  start: number,
  len: number,
  isDeflate: boolean,
  ctx: Context<WebSocketSession>,
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
    sendError(server, ctx, BasedErrorCode.FunctionNotFound, {
      name,
      requestId,
    })
    return false
  }

  if (route.observable === true) {
    sendError(server, ctx, BasedErrorCode.FunctionIsObservable, {
      name,
      requestId,
    })
    return false
  }

  if (len > route.maxPayloadSize) {
    sendError(server, ctx, BasedErrorCode.PayloadTooLarge, {
      name,
      requestId,
    })
    return false
  }

  if (route.stream === true) {
    sendError(server, ctx, BasedErrorCode.FunctionIsStream, {
      name,
      requestId,
    })
    return true
  }

  const payload = decodePayload(
    new Uint8Array(arr.slice(start + 8 + nameLen, start + len)),
    isDeflate
  )

  // TODO: make this fn a bit nicer.... remove nestedness...
  server.auth
    .authorize(ctx, name, payload)
    .then((ok) => {
      if (!ctx.session) {
        return false
      }

      if (!ok) {
        sendError(server, ctx, BasedErrorCode.AuthorizeRejectedError, {
          route,
        })
        return false
      }

      server.functions
        .install(name)
        .then((spec) => {
          if (!ctx.session) {
            return
          }
          if (spec && !isObservableFunctionSpec(spec)) {
            spec
              .function(payload, ctx)
              .then(async (v) => {
                ctx.session?.send(
                  encodeFunctionResponse(requestId, valueToBuffer(v)),
                  true,
                  false
                )
              })
              .catch((err) => {
                sendError(server, ctx, err.code, {
                  route,
                  requestId,
                  err,
                })
              })
          }
        })
        .catch(() =>
          sendError(server, ctx, BasedErrorCode.FunctionNotFound, {
            name,
            requestId,
          })
        )
    })
    .catch((err) => {
      sendError(server, ctx, BasedErrorCode.AuthorizeFunctionError, {
        route,
        err,
      })
    })

  return true
}
