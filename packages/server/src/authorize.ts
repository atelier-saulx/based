import { BasedServer } from './server.js'
import { sendError } from './sendError.js'
import { BasedErrorCode } from '@based/errors'
import {
  HttpSession,
  Context,
  WebSocketSession,
  BasedRoute,
  isBasedRoute,
  BasedFunctionConfig,
} from '@based/functions'
import { installFn } from './installFn.js'
import { AttachedCtx } from './query/types.js'

type ClientSession = HttpSession | WebSocketSession

export type AuthorizeProps<
  S extends ClientSession = ClientSession,
  R extends BasedRoute = BasedRoute,
  P = any,
> = {
  route: R
  server: BasedServer
  ctx: Context<S>
  payload: P
  authorized: IsAuthorizedHandler<S, R, P>
  error?: AuthErrorHandler<S, R, P>
  id?: number
  checksum?: number
  attachedCtx?: AttachedCtx
  missingFunction?: AuthErrorHandler<S, R, P>
}

export type IsAuthorizedHandler<
  S extends ClientSession = ClientSession,
  R extends BasedRoute = BasedRoute,
  P = any,
> = (
  props: AuthorizeProps<S, R, P>,
  spec: BasedFunctionConfig<R['type']>,
) => void

export type AuthErrorHandler<
  S extends ClientSession = ClientSession,
  R extends BasedRoute = BasedRoute,
  P = any,
> = (props: AuthorizeProps<S, R, P>, err?: Error) => true | void

export const defaultAuthError: AuthErrorHandler = (props, err) => {
  const code = err
    ? BasedErrorCode.AuthorizeFunctionError
    : BasedErrorCode.AuthorizeRejectedError

  const route = props.route

  if (props.id && isBasedRoute('channel', route)) {
    sendError(props.server, props.ctx, code, {
      route,
      err,
      channelId: props.id,
    })
    return
  }

  if (props.id && isBasedRoute('query', route)) {
    sendError(props.server, props.ctx, code, {
      route,
      err,
      observableId: props.id,
    })
    return
  }

  if (props.id) {
    sendError(props.server, props.ctx, code, {
      route,
      err,
      requestId: props.id,
    })
    return
  }

  sendError(props.server, props.ctx, code, {
    route,
    err,
  })
}

export const authorize = <
  S extends ClientSession = ClientSession,
  R extends BasedRoute = BasedRoute,
  P = any,
>(
  props: AuthorizeProps<S, R, P>,
  publicHandler: boolean = props.route.public,
) => {
  if (!props.ctx.session) {
    return
  }
  const onAuthError = props.error ?? defaultAuthError
  installFn(props.server, props.ctx, props.route, props.id).then((spec) => {
    if (!props.ctx.session) {
      return
    }

    if (spec === null) {
      if (props.missingFunction) {
        props.missingFunction(props)
      }
      return
    }

    if (publicHandler === true) {
      props.authorized(props, spec)
      return
    }

    const authorize = spec.authorize || props.server.auth.authorize

    authorize(props.server.client, props.ctx, props.route.name, props.payload)
      .then((ok) => {
        if (!props.ctx.session || !ok) {
          if (props.ctx.session && !onAuthError(props)) {
            defaultAuthError(props)
          }
          return
        }
        props.authorized(props, spec)
      })
      .catch((err) => {
        if (props.ctx.session && !onAuthError(props, err)) {
          defaultAuthError(props, err)
        }
      })
  })
}
