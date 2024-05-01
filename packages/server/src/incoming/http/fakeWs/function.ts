import { FakeBinaryMessageHandler } from './types.js'
import {
  readUint8,
  decodeName,
  decodePayload,
  encodeFunctionResponse,
  valueToBuffer,
  parsePayload,
  encodeErrorResponse,
} from '../../../protocol.js'
import { verifyRoute } from '../../../verifyRoute.js'
import { installFn } from '../../../installFn.js'
import { createError } from '../../../error/index.js'
import { BasedErrorCode } from '@based/errors'

export const handleFunction: FakeBinaryMessageHandler = (
  arr,
  startByte,
  len,
  isDeflate,
  ctx,
  server,
) => {
  // | 4 header | 3 id | 1 name length | * name | * payload |
  const requestId = readUint8(arr, startByte + 4, 3)
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

  const payload =
    len === nameLen + 8
      ? undefined
      : parsePayload(
          decodePayload(
            new Uint8Array(arr.slice(startByte + 8 + nameLen, startByte + len)),
            isDeflate,
          ),
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
      return encodeErrorResponse(valueToBuffer(errorData))
    }

    return spec
      .fn(server.client, payload, ctx)
      .then((v) => {
        return encodeFunctionResponse(requestId, valueToBuffer(v))
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
        return encodeErrorResponse(valueToBuffer(errorData))
      })
  })
}
