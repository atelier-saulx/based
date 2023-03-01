import { BasedServer } from '../../server'
import {
  HttpSession,
  Context,
  SendHttpResponse,
  HttpHeaders,
} from '@based/functions'
import {
  BasedFunctionRoute,
  BasedQueryFunctionRoute,
  BasedQueryFunctionSpec,
} from '../../functions'
import { end, sendHeaders } from '../../sendHttpResponse'
import { compress } from '../../compress'
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
} from '../../observable'
import zlib from 'node:zlib'
import { parseQuery } from '@saulx/utils'
import { BasedErrorCode } from '../../error'
import { sendError } from '../../sendError'
import { promisify } from 'node:util'
import { authorize, IsAuthorizedHandler } from '../../authorize'

const inflate = promisify(zlib.inflate)

const sendCacheSwapEncoding = async (
  server: BasedServer,
  route: BasedFunctionRoute,
  ctx: Context<HttpSession>,
  buffer: Uint8Array,
  checksum: number,
  headers?: HttpHeaders,
  status: string = '200 OK'
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
  status: string = '200 OK'
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
    end(ctx, buffer.slice(20))
  })
}

const sendNotModified = (
  ctx: Context<HttpSession>,
  headers?: HttpHeaders,
  status: string = '304 Not Modified'
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
  route: BasedFunctionRoute,
  server: BasedServer,
  id: number,
  obs: ActiveObservable,
  checksum: number,
  ctx: Context<HttpSession>,
  headers?: HttpHeaders,
  status?: string
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
        sendCache(ctx, obs.cache, obs.checksum, true, headers, status)
      } else {
        sendCacheSwapEncoding(
          server,
          route,
          ctx,
          obs.cache,
          obs.checksum,
          headers,
          status
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
  route: BasedQueryFunctionRoute,
  spec: BasedQueryFunctionSpec,
  server: BasedServer,
  id: number,
  obs: ActiveObservable,
  checksum: number,
  ctx: Context<HttpSession>
) => {
  if ('httpResponse' in spec) {
    // response data does not work for query responses
    const send: SendHttpResponse = (responseData, headers, status) => {
      sendGetResponseInternal(
        route,
        server,
        id,
        obs,
        checksum,
        ctx,
        headers,
        typeof status === 'string' ? status : String(status)
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
  route: BasedQueryFunctionRoute,
  spec: BasedQueryFunctionSpec,
  checksum: number
) => {
  const obs = getObsAndStopRemove(server, id)

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

const isAuthorized: IsAuthorizedHandler<
  HttpSession,
  BasedQueryFunctionRoute
> = (route, spec, server, ctx, payload, id, checksum) => {
  const name = route.name

  if (hasObs(server, id)) {
    getFromExisting(server, id, ctx, route, spec, checksum)
    return
  }

  const obs = createObs(server, name, id, payload, true)
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
  route: BasedQueryFunctionRoute,
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

  authorize(
    route,
    server,
    ctx,
    payload,
    isAuthorized,
    genObservableId(route.name, payload),
    checksum
  )
}
