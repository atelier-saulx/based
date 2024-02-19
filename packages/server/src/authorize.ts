import { BasedServer } from './server.js'
import { sendError } from './sendError.js'
import { BasedErrorCode } from '@based/errors'
import {
  HttpSession,
  Context,
  WebSocketSession,
  BasedRoute,
  BasedFunctionConfig,
  isBasedRoute,
} from '@based/functions'
import { installFn } from './installFn.js'

type ClientSession = HttpSession | WebSocketSession

export type IsAuthorizedHandler<
  S extends ClientSession = ClientSession,
  R extends BasedRoute = BasedRoute,
  P = any
> = (
  route: R,
  spec: BasedFunctionConfig<R['type']>,
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
  _payload,
  id,
  _checksum,
  err
) => {
  const code = err
    ? BasedErrorCode.AuthorizeFunctionError
    : BasedErrorCode.AuthorizeRejectedError

  if (id && isBasedRoute('channel', route)) {
    sendError(server, ctx, code, {
      route,
      err,
      channelId: id,
    })
    return
  }

  if (id && isBasedRoute('query', route)) {
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
  isPublic: boolean = false,
  authError: AuthErrorHandler<S, R, P> = defaultAuthError
) => {
  if (!ctx.session) {
    return
  }

  installFn(server, ctx, route, id).then((spec) => {
    if (spec === null) {
      return
    }

    if (route.public === true || isPublic) {
      isAuthorized(route, spec, server, ctx, payload, id, checksum)
      return
    }

    const authorize = spec.authorize || server.auth.authorize

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
        isAuthorized(route, spec, server, ctx, payload, id, checksum)
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
