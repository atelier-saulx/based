import { BasedServer } from '../../server.js'
import {
  HttpSession,
  Context,
  SendHttpResponse,
  HttpHeaders,
  BasedRoute,
  BasedFunctionConfig,
} from '@based/functions'
import { end, sendHeaders } from '../../sendHttpResponse.js'
import { compress } from '../../compress.js'
import {
  createObs,
  destroyObs,
  getObsAndStopRemove,
  hasObs,
  sendObsGetError,
  subscribeNext,
  ActiveObservable,
  start,
  genObservableId,
} from '../../query/index.js'
import zlib from 'node:zlib'
import { BasedErrorCode } from '@based/errors'
import { sendError } from '../../sendError.js'
import { promisify } from 'node:util'
import { authorize, IsAuthorizedHandler } from '../../authorize.js'

const inflate = promisify(zlib.inflateRaw)

const PROTOCOL_CACHE_RAW_OFFSET = 21

const sendCacheSwapEncoding = async (
  server: BasedServer,
  route: BasedRoute<'query'>,
  ctx: Context<HttpSession>,
  buffer: Uint8Array,
  checksum: number,
  headers?: HttpHeaders,
  status: string = '200 OK',
) => {
  try {
    const inflated = await inflate(buffer.subarray(PROTOCOL_CACHE_RAW_OFFSET))

    const { payload, encoding } = await compress(
      inflated,
      ctx.session.headers.encoding,
    )
    if (!ctx.session.res) {
      return
    }
    ctx.session.res.cork(() => {
      if (headers) {
        sendHeaders(ctx, headers)
      }
      ctx.session.res.writeStatus(status)
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
  isDeflate: boolean,
  headers?: HttpHeaders,
  status: string = '200 OK',
) => {
  ctx.session.res.cork(() => {
    if (headers) {
      sendHeaders(ctx, headers)
    }

    ctx.session.res.writeStatus(status)
    ctx.session.res.writeHeader('ETag', String(checksum))
    if (isDeflate) {
      ctx.session.res.writeHeader('Content-Encoding', 'deflate')
    }

    end(ctx, buffer.subarray(PROTOCOL_CACHE_RAW_OFFSET))
  })
}

const sendNotModified = (
  ctx: Context<HttpSession>,
  headers?: HttpHeaders,
  status: string = '304 Not Modified',
) => {
  ctx.session.res.cork(() => {
    if (headers) {
      sendHeaders(ctx, headers)
    }
    ctx.session.res.writeStatus(status)
    end(ctx)
  })
}

const sendGetResponseInternal = (
  route: BasedRoute<'query'>,
  server: BasedServer,
  id: number,
  obs: ActiveObservable,
  checksum: number,
  ctx: Context<HttpSession>,
  headers?: HttpHeaders,
  status?: string,
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
        route: { name: obs.name, type: 'query' },
      })
    } else if (obs.isDeflate) {
      if (typeof encoding === 'string' && encoding.includes('deflate')) {
        sendCache(ctx, obs.cache, obs.checksum, true, headers, status)
      } else {
        sendCacheSwapEncoding(
          server,
          route,
          ctx,
          obs.cache,
          obs.checksum,
          headers,
          status,
        )
      }
    } else {
      sendCache(ctx, obs.cache, obs.checksum, false, headers, status)
    }
  } else {
    sendNotModified(ctx)
  }
  destroyObs(server, id)
}

const sendGetResponse = (
  route: BasedRoute<'query'>,
  spec: BasedFunctionConfig<'query'>,
  server: BasedServer,
  id: number,
  obs: ActiveObservable,
  checksum: number,
  ctx: Context<HttpSession>,
) => {
  if ('httpResponse' in spec) {
    // response data does not work for query responses
    const send: SendHttpResponse = (_responseData, headers, status) => {
      sendGetResponseInternal(
        route,
        server,
        id,
        obs,
        checksum,
        ctx,
        headers,
        typeof status === 'string' ? status : String(status),
      )
    }
    spec.httpResponse(server.client, obs.payload, obs.cache, send, ctx)
    return
  }

  sendGetResponseInternal(route, server, id, obs, checksum, ctx)
}

const getFromExisting = (
  server: BasedServer,
  id: number,
  ctx: Context<HttpSession>,
  route: BasedRoute<'query'>,
  spec: BasedFunctionConfig<'query'>,
  checksum: number,
) => {
  const obs = getObsAndStopRemove(server, id)

  if (server.queryEvents) {
    server.queryEvents.get(obs, ctx)
  }

  if (obs.error) {
    sendObsGetError(server, ctx, obs.id, obs.error)
    return
  }

  if (obs.cache) {
    sendGetResponse(route, spec, server, id, obs, checksum, ctx)
    return
  }

  subscribeNext(obs, (err) => {
    if (!ctx.session) {
      return
    }
    if (err) {
      sendObsGetError(server, ctx, obs.id, err)
    } else {
      sendGetResponse(route, spec, server, id, obs, checksum, ctx)
    }
  })
}

const isAuthorized: IsAuthorizedHandler<HttpSession, BasedRoute<'query'>> = (
  route,
  spec,
  server,
  ctx,
  payload,
  id,
  checksum,
) => {
  const name = route.name

  if (hasObs(server, id)) {
    getFromExisting(server, id, ctx, route, spec, checksum)
    return
  }

  const obs = createObs(server, name, id, payload, true)

  if (server.queryEvents) {
    server.queryEvents.get(obs, ctx)
  }

  subscribeNext(obs, (err) => {
    if (err) {
      sendObsGetError(server, ctx, obs.id, err)
    } else {
      sendGetResponse(route, spec, server, id, obs, checksum, ctx)
    }
  })
  start(server, id)
}

export const httpGet = (
  route: BasedRoute<'query'>,
  payload: any,
  ctx: Context<HttpSession>,
  server: BasedServer,
  checksum: number,
): void => {
  if (!ctx.session) {
    return
  }

  authorize(
    route,
    server,
    ctx,
    payload,
    isAuthorized,
    genObservableId(route.name, payload),
    checksum,
  )
}
