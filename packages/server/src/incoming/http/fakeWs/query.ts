import {
  createObs,
  getObsAndStopRemove,
  hasObs,
  subscribeNext,
  start,
} from '../../../query/index.js'
import { FakeBinaryMessageHandler } from './types.js'
import {
  decodeName,
  decodePayload,
  valueToBuffer,
  updateId,
  encodeErrorResponse,
} from '../../../protocol.js'
import { verifyRoute } from '../../../verifyRoute.js'
import { createError } from '../../../error/index.js'
import { BasedErrorCode } from '@based/errors'
import { readUint64 } from '@based/utils'

const EMPTY = Buffer.allocUnsafe(0)

export const handleQuery: FakeBinaryMessageHandler = (
  arr,
  startByte,
  len,
  isDeflate,
  ctx,
  server,
) => {
  // | 4 header | 8 id | 8 checksum | 1 name length | * name | * payload |

  const nameLen = arr[startByte + 20]
  const id = readUint64(arr, startByte + 4)
  const checksum = readUint64(arr, startByte + 12)
  const name = decodeName(arr, startByte + 21, startByte + 21 + nameLen)

  if (!name || !id) {
    return
  }

  const route = verifyRoute(
    server,
    ctx,
    'query',
    server.functions.route(name),
    name,
    id,
  )

  const payload =
    len === nameLen + 21
      ? undefined
      : decodePayload(
          new Uint8Array(arr.slice(startByte + 21 + nameLen, startByte + len)),
          isDeflate,
          false, // FIXME later
          // @ts-ignore
          // ctx.session.v < 2,
        )

  if (route === null) {
    return
  }

  // COMPARE CHECKSUMS
  return new Promise(async (resolve, reject) => {
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
          observableId: id,
        },
      )
      resolve(encodeErrorResponse(valueToBuffer(errorData, true)))
      return
    }

    if (hasObs(server, id)) {
      const obs = getObsAndStopRemove(server, id)
      if (obs.cache) {
        if (obs.checksum === checksum) {
          resolve(EMPTY)
          return
        }
        const buffer = obs.cache
        if (obs.reusedCache) {
          const prevId = updateId(buffer, obs.id)
          buffer.set(prevId, 4)
        }
        resolve(buffer)
      } else {
        resolve(EMPTY)
      }
      return
    }
    const obs = createObs(server, name, id, payload, true)
    if (server.queryEvents) {
      server.queryEvents.get(obs, ctx)
    }
    subscribeNext(obs, (err) => {
      if (err) {
        resolve(EMPTY)
        // console.error('NOT HANDLED')
      } else {
        const buffer = obs.cache
        if (obs.reusedCache) {
          const prevId = updateId(buffer, obs.id)
          buffer.set(prevId, 4)
        }
        resolve(buffer)
      }
    })
    start(server, id)
  })
}
