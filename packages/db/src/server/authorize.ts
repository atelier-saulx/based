import { sendError } from './sendError.js'
import { installFn } from './installFn.js'
import { ClientSession, FunctionErrorHandler, FunctionProps } from './types.js'
import { BasedErrorCode } from '../errors/types.js'
import {
  isBasedRoute,
  type BasedFunctionConfig,
  type BasedRoute,
} from '../functions/functions.js'

export const defaultAuthError: FunctionErrorHandler<ClientSession> = (
  props,
  err,
) => {
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
  props: FunctionProps<S, R, P>,
  publicHandler: boolean = props.route.public || false,
): Promise<
  FunctionProps<S, R, P> & { spec: BasedFunctionConfig<R['type']> }
> => {
  return {
    // @ts-ignore (higher perf then a promise)
    then: (resolve) => {
      if (!props.ctx.session) {
        return
      }
      const onAuthError = props.error ?? defaultAuthError
      installFn(props).then((spec) => {
        if (!props.ctx.session) {
          return
        }

        if (spec === null) {
          return
        }

        if (publicHandler === true) {
          // @ts-ignore
          props.spec = spec
          // @ts-ignore
          resolve(props)
          return
        }

        const authorize = spec.authorize || props.server.auth.authorize

        // non async auth as option?

        authorize(
          props.server.client,
          props.ctx,
          props.route.name,
          props.payload,
        )
          .then((ok) => {
            if (!props.ctx.session || !ok) {
              if (props.ctx.session && !onAuthError(props)) {
                defaultAuthError(props)
              }
              return
            }
            // @ts-ignore
            props.spec = spec
            // @ts-ignore
            resolve(props)
          })
          .catch((err) => {
            if (props.ctx.session && !onAuthError(props, err)) {
              defaultAuthError(props, err)
            }
          })
      })
    },
  }
}
