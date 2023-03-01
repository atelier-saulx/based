import { BasedServer } from './server'
import {
  BasedRoute,
  isChannelFunctionRoute,
  isQueryFunctionRoute,
} from './functions'
import { sendError } from './sendError'
import { BasedErrorCode } from './error'
import { HttpSession, Context, WebSocketSession } from '@based/functions'
import { installFn } from './installFn'

type ClientSession = HttpSession | WebSocketSession

export type IsAuthorizedHandler<
  S extends ClientSession = ClientSession,
  R extends BasedRoute = BasedRoute,
  P = any
> = (
  spec: R,
  server: BasedServer,
  ctx: Context<S>,
  payload: P,
  id?: number,
  checksum?: number
) => void

export type AuthErrorHandler<
  S extends ClientSession = ClientSession,
  R extends BasedRoute = BasedRoute,
  P = any
> = (
  route: R,
  server: BasedServer,
  ctx: Context<S>,
  payload: P,
  id?: number,
  checksum?: number,
  err?: Error
) => true | void

export const defaultAuthError: AuthErrorHandler = (
  route,
  server,
  ctx,
  payload,
  id,
  checksum,
  err
) => {
  const code = err
    ? BasedErrorCode.AuthorizeFunctionError
    : BasedErrorCode.AuthorizeRejectedError

  if (id && isChannelFunctionRoute(route)) {
    sendError(server, ctx, code, {
      route,
      err,
      channelId: id,
    })
    return
  }

  if (id && isQueryFunctionRoute(route)) {
    sendError(server, ctx, code, {
      route,
      err,
      observableId: id,
    })
    return
  }

  if (id) {
    sendError(server, ctx, code, {
      route,
      err,
      requestId: id,
    })
    return
  }

  sendError(server, ctx, code, {
    route,
    err,
  })
}

export const authorize = <
  S extends ClientSession = ClientSession,
  R extends BasedRoute = BasedRoute,
  P = any
>(
  route: R,
  server: BasedServer,
  ctx: Context<S>,
  payload: P,
  isAuthorized: IsAuthorizedHandler<S, R, P>,
  id?: number,
  checksum?: number,
  authError: AuthErrorHandler<S, R, P> = defaultAuthError
) => {
  if (!ctx.session) {
    return
  }

  installFn(server, ctx, route, id).then((spec) => {
    if (route.public === true) {
      isAuthorized(route, server, ctx, payload, id, checksum)
      return
    }

    const authorize = spec?.authorize || server.auth.authorize

    authorize(server.client, ctx, route.name, payload)
      .then((ok) => {
        if (!ctx.session || !ok) {
          if (
            ctx.session &&
            !authError(route, server, ctx, payload, id, checksum)
          ) {
            defaultAuthError(route, server, ctx, payload, id, checksum)
          }
          return
        }
        isAuthorized(route, server, ctx, payload, id, checksum)
      })
      .catch((err) => {
        if (
          ctx.session &&
          !authError(route, server, ctx, payload, id, checksum, err)
        ) {
          defaultAuthError(route, server, ctx, payload, id, checksum, err)
        }
      })
  })
}
