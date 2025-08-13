import { FakeBinaryMessageHandler } from './types.js'
import {
  decodeName,
  decodePayload,
  encodeFunctionResponse,
  valueToBuffer,
  encodeErrorResponse,
} from '../../../protocol.js'
import { verifyRoute } from '../../../verifyRoute.js'
import { installFn } from '../../../installFn.js'
import { createError } from '../../../error/index.js'
import { BasedErrorCode } from '@based/errors'
import { readUint24 } from '@based/utils'

export const handleFunction: FakeBinaryMessageHandler = (
  arr,
  startByte,
  len,
  isDeflate,
  ctx,
  server,
) => {
  // | 4 header | 3 id | 1 name length | * name | * payload |
  const requestId = readUint24(arr, startByte + 4)
  const nameLen = arr[startByte + 7]
  const name = decodeName(arr, startByte + 8, startByte + 8 + nameLen)

  if (!name || !requestId) {
    return
  }

  const route = verifyRoute(
    server,
    ctx,
    'function',
    server.functions.route(name),
    name,
    requestId,
  )

  if (route === null) {
    return
  }

  const isOldClient = ctx.session.authState.v < 2

  const payload =
    len === nameLen + 8
      ? undefined
      : decodePayload(
          new Uint8Array(arr.slice(startByte + 8 + nameLen, startByte + len)),
          isDeflate,
          isOldClient,
        )

  return installFn(server, ctx, route).then(async (spec) => {
    const isAuth =
      route.public ||
      (await server.auth
        .authorize(server.client, ctx, route.name, payload)
        .catch(() => false))

    if (!isAuth) {
      const errorData = createError(
        server,
        ctx,
        BasedErrorCode.AuthorizeRejectedError,
        {
          route,
          requestId,
        },
      )
      return encodeErrorResponse(valueToBuffer(errorData, true))
    }

    return spec
      .fn(server.client, payload, ctx)
      .then((v) => {
        return encodeFunctionResponse(requestId, valueToBuffer(v, true))
      })
      .catch((err) => {
        const errorData = createError(
          server,
          ctx,
          BasedErrorCode.FunctionError,
          {
            route,
            requestId,
            err,
          },
        )
        return encodeErrorResponse(valueToBuffer(errorData, true))
      })
  })
}
