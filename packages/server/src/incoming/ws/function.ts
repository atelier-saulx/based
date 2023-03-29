import {
  readUint8,
  decodeName,
  decodePayload,
  encodeFunctionResponse,
  valueToBuffer,
  parsePayload,
} from '../../protocol'
import { BasedErrorCode } from '../../error'
import { sendError } from '../../sendError'
import { BasedFunctionRoute } from '../../functions'
import { WebSocketSession } from '@based/functions'
import { rateLimitRequest } from '../../security'
import { verifyRoute } from '../../verifyRoute'
import { authorize, IsAuthorizedHandler } from '../../authorize'
import { BinaryMessageHandler } from './types'
import { Duplex, Readable } from 'stream'
import { readStream } from '@saulx/utils'

// combine authorize with installfn AuthorizeAndInstall

const sendFunction: IsAuthorizedHandler<
  WebSocketSession,
  BasedFunctionRoute
> = (route, spec, server, ctx, payload, requestId) => {
  if (spec.relay) {
    const client = server.clients[spec.relay]
    if (!client) {
      sendError(server, ctx, BasedErrorCode.FunctionError, {
        route,
        requestId,
        err: new Error('Cannot find client ' + spec.relay),
      })
      return
    }

    client
      .call(spec.name, payload)
      .then(async (v) => {
        ctx.session?.ws.send(
          encodeFunctionResponse(requestId, valueToBuffer(v)),
          true,
          false
        )
      })
      .catch((err) => {
        sendError(server, ctx, BasedErrorCode.FunctionError, {
          route,
          requestId,
          err,
        })
      })

    return
  }

  spec
    .function(server.client, payload, ctx)
    .then(async (v) => {
      // TODO: allow chunked reply!
      if (v && (v instanceof Duplex || v instanceof Readable)) {
        v = await readStream(v)
      }
      ctx.session?.ws.send(
        encodeFunctionResponse(requestId, valueToBuffer(v)),
        true,
        false
      )
    })
    .catch((err) => {
      sendError(server, ctx, BasedErrorCode.FunctionError, {
        route,
        requestId,
        err,
      })
    })
}

export const functionMessage: BinaryMessageHandler = (
  arr,
  start,
  len,
  isDeflate,
  ctx,
  server
) => {
  // | 4 header | 3 id | 1 name length | * name | * payload |
  const requestId = readUint8(arr, start + 4, 3)
  const nameLen = arr[start + 7]
  const name = decodeName(arr, start + 8, start + 8 + nameLen)

  if (!name || !requestId) {
    return false
  }

  const route = verifyRoute(
    server,
    ctx,
    'fn',
    server.functions.route(name),
    name,
    requestId
  )

  // TODO: add strictness setting - if strict return false here
  if (route === null) {
    return true
  }

  if (
    rateLimitRequest(server, ctx, route.rateLimitTokens, server.rateLimit.ws)
  ) {
    ctx.session.ws.close()
    return false
  }

  if (len > route.maxPayloadSize) {
    sendError(server, ctx, BasedErrorCode.PayloadTooLarge, {
      route,
      requestId,
    })
    return true
  }

  const payload =
    len === nameLen + 8
      ? undefined
      : parsePayload(
          decodePayload(
            new Uint8Array(arr.slice(start + 8 + nameLen, start + len)),
            isDeflate
          )
        )

  authorize(route, server, ctx, payload, sendFunction, requestId)

  return true
}
