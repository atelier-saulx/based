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
import { installFn } from '../../installFn'
import { authorize, IsAuthorizedHandler } from '../../authorize'
import { BinaryMessageHandler } from './types'
import { Duplex, Readable } from 'stream'
import { readStream } from '@saulx/utils'

const sendFunction: IsAuthorizedHandler<
  WebSocketSession,
  BasedFunctionRoute
> = async (route, server, ctx, payload, requestId) => {
  const spec = await installFn(server, ctx, route, requestId)
  spec
    ?.function(server.client, payload, ctx)
    .then(async (v) => {
      if (v && (v instanceof Duplex || v instanceof Readable)) {
        v = await readStream(v)
      }
      ctx.session?.send(
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
    ctx.session.close()
    return false
  }

  if (len > route.maxPayloadSize) {
    sendError(server, ctx, BasedErrorCode.PayloadTooLarge, {
      route,
      requestId,
    })
    return true
  }

  const payload = parsePayload(
    decodePayload(
      new Uint8Array(arr.slice(start + 8 + nameLen, start + len)),
      isDeflate
    )
  )

  authorize(route, server, ctx, payload, sendFunction, requestId)

  return true
}
