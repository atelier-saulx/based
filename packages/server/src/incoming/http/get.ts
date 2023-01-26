import { BasedServer } from '../../server'
import { HttpSession, Context } from '@based/functions'
import { BasedFunctionRoute, isObservableFunctionSpec } from '../../functions'
import { end } from '../../sendHttpResponse'
import { compress } from '../../compress'
import {
  createObs,
  destroyObs,
  getObs,
  hasObs,
  sendObsGetError,
  subscribeNext,
  ActiveObservable,
  start,
  genObservableId,
} from '../../observable'
import zlib from 'node:zlib'
import { parseQuery } from '@saulx/utils'
import { BasedErrorCode } from '../../error'
import { sendError } from '../../sendError'
import { promisify } from 'node:util'

const inflate = promisify(zlib.inflate)

const sendCacheSwapEncoding = async (
  server: BasedServer,
  route: BasedFunctionRoute,
  ctx: Context<HttpSession>,
  buffer: Uint8Array,
  checksum: number
) => {
  try {
    const inflated = await inflate(buffer.slice(20))
    const { payload, encoding } = await compress(
      inflated,
      ctx.session.headers.encoding
    )
    if (!ctx.session.res) {
      return
    }
    ctx.session.res.cork(() => {
      ctx.session.res.writeStatus('200 OK')
      if (encoding) {
        ctx.session.res.writeHeader('Content-Encoding', encoding)
      }
      ctx.session.res.writeHeader('ETag', String(checksum))
      end(ctx, payload)
    })
  } catch (err) {
    sendError(server, ctx, BasedErrorCode.UnsupportedContentEncoding, route)
  }
}

const sendCache = (
  ctx: Context<HttpSession>,
  buffer: Uint8Array,
  checksum: number,
  isDeflate: boolean
) => {
  ctx.session.res.cork(() => {
    ctx.session.res.writeStatus('200 OK')
    ctx.session.res.writeHeader('ETag', String(checksum))
    if (isDeflate) {
      ctx.session.res.writeHeader('Content-Encoding', 'deflate')
    }
    end(ctx, buffer.slice(20))
  })
}

const sendNotModified = (ctx: Context<HttpSession>) => {
  ctx.session.res.cork(() => {
    ctx.session.res.writeStatus('304 Not Modified')
    end(ctx)
  })
}

const sendGetResponse = (
  route: BasedFunctionRoute,
  server: BasedServer,
  id: number,
  obs: ActiveObservable,
  checksum: number,
  ctx: Context<HttpSession>
) => {
  if (!ctx.session) {
    destroyObs(server, id)
    return
  }

  const encoding = ctx.session.headers.encoding

  if (checksum === 0 || checksum !== obs.checksum) {
    if (!obs.cache) {
      sendError(server, ctx, BasedErrorCode.NoOservableCacheAvailable, {
        observableId: id,
        route: { name: obs.name },
      })
    } else if (obs.isDeflate) {
      if (typeof encoding === 'string' && encoding.includes('deflate')) {
        sendCache(ctx, obs.cache, obs.checksum, true)
      } else {
        sendCacheSwapEncoding(server, route, ctx, obs.cache, obs.checksum)
      }
    } else {
      sendCache(ctx, obs.cache, obs.checksum, false)
    }
  } else {
    sendNotModified(ctx)
  }
  destroyObs(server, id)
}

const getFromExisting = (
  server: BasedServer,
  id: number,
  ctx: Context<HttpSession>,
  route: BasedFunctionRoute,
  checksum: number
) => {
  const obs = getObs(server, id)

  if (obs.error) {
    sendObsGetError(server, ctx, obs.id, obs.name, obs.error)
    return
  }

  if (obs.cache) {
    sendGetResponse(route, server, id, obs, checksum, ctx)
    return
  }

  subscribeNext(obs, (err) => {
    if (!ctx.session) {
      return
    }

    if (err) {
      sendObsGetError(server, ctx, obs.id, obs.name, err)
    } else {
      sendGetResponse(route, server, id, obs, checksum, ctx)
    }
  })
}

export const httpGet = (
  route: BasedFunctionRoute,
  payload: any,
  ctx: Context<HttpSession>,
  server: BasedServer,
  checksum: number
): void => {
  if (!ctx.session) {
    return
  }

  if (payload === undefined && 'query' in ctx.session) {
    try {
      payload = parseQuery(decodeURIComponent(ctx.session.query))
    } catch (err) {}
  }

  const name = route.name
  const id = genObservableId(name, payload)

  if (hasObs(server, id)) {
    getFromExisting(server, id, ctx, route, checksum)
    return
  }

  server.functions
    .install(name)
    .then((spec) => {
      if (!ctx.session) {
        return
      }
      if (!spec) {
        sendError(server, ctx, BasedErrorCode.FunctionNotFound, route)
        return
      }

      if (!isObservableFunctionSpec(spec)) {
        sendError(server, ctx, BasedErrorCode.FunctionIsNotObservable, route)
        return
      }

      if (hasObs(server, id)) {
        getFromExisting(server, id, ctx, route, checksum)
        return
      }

      const obs = createObs(server, name, id, payload, true)
      subscribeNext(obs, (err) => {
        if (err) {
          sendObsGetError(server, ctx, obs.id, obs.name, err)
        } else {
          sendGetResponse(route, server, id, obs, checksum, ctx)
        }
      })
      start(server, id)
    })
    .catch((err) => {
      // TODO: error type
      console.error('Internal: Unxpected error in observable', err)
      sendError(server, ctx, BasedErrorCode.FunctionNotFound, route)
    })
}
