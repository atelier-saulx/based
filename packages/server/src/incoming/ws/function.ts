import {
  decodeName,
  decodePayload,
  encodeFunctionResponse,
  valueToBuffer,
  valueToBufferV1,
} from '../../protocol.js'
import { BasedErrorCode } from '@based/errors'
import { sendError } from '../../sendError.js'
import { WebSocketSession, BasedRoute } from '@based/functions'
import { rateLimitRequest } from '../../security.js'
import { verifyRoute } from '../../verifyRoute.js'
import { authorize, IsAuthorizedHandler } from '../../authorize.js'
import { BinaryMessageHandler } from './types.js'
import { Duplex, Readable } from 'stream'
import { readStream } from '@based/utils'
import { readUint24 } from '@based/utils'

const sendFunction: IsAuthorizedHandler<
  WebSocketSession,
  BasedRoute<'function'>
> = (route, spec, server, ctx, payload, requestId) => {
  if (spec.relay) {
    const client = server.clients[spec.relay.client]
    if (!client) {
      sendError(server, ctx, BasedErrorCode.FunctionError, {
        route,
        requestId,
        err: new Error('Cannot find client ' + spec.relay),
      })
      return
    }

    client
      .call(spec.relay.target ?? spec.name, payload)
      .then(async (v: any) => {
        ctx.session?.ws.send(
          encodeFunctionResponse(
            requestId,
            ctx.session.v < 2
              ? valueToBufferV1(v, true)
              : valueToBuffer(v, true),
          ),
          true,
          false,
        )
      })
      .catch((err: Error) => {
        sendError(server, ctx, BasedErrorCode.FunctionError, {
          route,
          requestId,
          err,
        })
      })

    return
  }

  spec
    .fn(server.client, payload, ctx)
    .then(async (v) => {
      // TODO: allow chunked REPLY!
      if (v && (v instanceof Duplex || v instanceof Readable)) {
        v = await readStream(v)
      }

      ctx.session?.ws.send(
        encodeFunctionResponse(
          requestId,
          ctx.session.v < 2 ? valueToBufferV1(v, true) : valueToBuffer(v, true),
        ),
        true,
        false,
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
  server,
) => {
  // | 4 header | 3 id | 1 name length | * name | * payload |
  const requestId = readUint24(arr, start + 4)
  const nameLen = arr[start + 7]
  const name = decodeName(arr, start + 8, start + 8 + nameLen)

  if (!name || !requestId) {
    return false
  }

  const route = verifyRoute(
    server,
    ctx,
    'function',
    server.functions.route(name),
    name,
    requestId,
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
      : decodePayload(
          new Uint8Array(arr.slice(start + 8 + nameLen, start + len)),
          isDeflate,
          ctx.session.v < 2,
        )

  authorize(route, server, ctx, payload, sendFunction, requestId)

  return true
}
