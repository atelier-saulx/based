import {
  getObsAndStopRemove,
  hasObs,
  subscribeNext,
  start,
  createObsNoStart,
} from '../../../query/index.js'
import { FakeBinaryMessageHandler } from './types.js'
import { decodeName, decodePayload, updateId } from '../../../protocol.js'
import { verifyRoute } from '../../../verifyRoute.js'
import { authorize } from '../../../authorize.js'
import { attachCtx } from '../../../query/attachCtx.js'
import { FunctionHandler } from '../../../types.js'
import type { BasedRoute, HttpSession } from '../../../../functions/index.js'
import { readUint64 } from '../../../../utils/index.js'

const EMPTY = Buffer.allocUnsafe(0)

const get: FunctionHandler<HttpSession, BasedRoute<'query'>> = (props) => {
  return new Promise(async (resolve, reject) => {
    const { server, id, checksum, ctx } = props
    if (hasObs(server, id!)) {
      const obs = getObsAndStopRemove(server, id!)
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
        return
      } else {
        resolve(EMPTY)
        return
      }
    }
    const obs = createObsNoStart(props)
    if (server.queryEvents) {
      server.queryEvents.get(obs, ctx)
    }
    subscribeNext(obs, (err) => {
      if (err) {
        resolve(EMPTY)
        return
      } else {
        const buffer = obs.cache
        if (obs.reusedCache) {
          const prevId = updateId(buffer, obs.id)
          buffer.set(prevId, 4)
        }
        resolve(buffer)
        return
      }
    })
    start(server, id!)
  })
}

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
  if (!ctx.session) {
    return
  }

  return new Promise(async (resolve, reject) => {
    if (route.ctx) {
      const attachedCtx = attachCtx(server, route, ctx, id)
      authorize({
        route,
        server,
        ctx,
        payload,
        id: attachedCtx.id,
        checksum,
        attachedCtx,
      }).then((p) => {
        if (attachedCtx && attachedCtx.authState) {
          const attachedCtx2 = attachCtx(server, route, ctx, id)
          if (attachedCtx2.id !== attachedCtx.id) {
            p.id = attachedCtx2.id
            p.attachedCtx = attachedCtx2
          }
        }
        get(p).then(resolve)
      })
    } else {
      authorize({
        route,
        server,
        ctx,
        payload,
        id,
        checksum,
      }).then((x) => {
        get(x).then(resolve)
      })
    }
  })
}
