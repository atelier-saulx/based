import { Context, isClientContext } from '@based/functions'
import {
  BasedFunctionRoute,
  BasedQueryFunctionRoute,
  BasedRoute,
  BasedStreamFunctionRoute,
  isQueryFunctionRoute,
  isStreamFunctionRoute,
  isFunctionRoute,
} from './functions'
import { sendError } from './sendError'
import { BasedErrorCode, createError } from './error'
import { BasedServer } from './server'

type FnType = 'query' | 'stream' | 'fn'

export const verifyRoute = <T extends FnType>(
  server: BasedServer,
  ctx: Context = server.client.ctx,
  type: T,
  route: BasedRoute | null,
  name: string,
  id?: number
):
  | (T extends 'query'
      ? BasedQueryFunctionRoute
      : T extends 'stream'
      ? BasedStreamFunctionRoute
      : BasedFunctionRoute)
  | null => {
  if (!ctx.session) {
    console.warn('VERIFY ROUTE NO SESSION', name)
    return null
  }

  if (!route) {
    if (!isClientContext(ctx)) {
      throw createError(server, ctx, BasedErrorCode.FunctionNotFound, {
        route: {
          name,
        },
      })
    }
    sendError(
      server,
      ctx,
      BasedErrorCode.FunctionNotFound,
      type === 'query'
        ? {
            route: { name },
            observableId: id,
          }
        : {
            route: { name },
            requestId: id,
          }
    )
    return null
  }

  if (route.internalOnly === true && isClientContext(ctx)) {
    sendError(
      server,
      ctx,
      BasedErrorCode.FunctionNotFound,
      type === 'query'
        ? {
            route: { name },
            observableId: id,
          }
        : {
            route: { name },
            requestId: id,
          }
    )
    return null
  }

  if (type === 'query') {
    if (!isQueryFunctionRoute(route)) {
      if (!isClientContext(ctx)) {
        throw createError(server, ctx, BasedErrorCode.FunctionIsNotObservable, {
          route,
        })
      }
      sendError(server, ctx, BasedErrorCode.FunctionIsNotObservable, {
        route: { name },
        observableId: id,
      })
      return null
    }
  }

  if (type === 'stream') {
    if (!isStreamFunctionRoute(route)) {
      if (!isClientContext(ctx)) {
        throw createError(server, ctx, BasedErrorCode.FunctionIsNotStream, {
          route,
        })
      }
      sendError(server, ctx, BasedErrorCode.FunctionIsNotStream, {
        route: { name },
        requestId: id,
      })
      return null
    }
  }

  if (type === 'fn' && !isFunctionRoute(route)) {
    if (!isClientContext(ctx)) {
      if (isStreamFunctionRoute(route)) {
        throw createError(server, ctx, BasedErrorCode.FunctionIsNotObservable, {
          route,
        })
      }
      throw createError(server, ctx, BasedErrorCode.FunctionIsObservable, {
        route,
      })
    }
    if (isStreamFunctionRoute(route)) {
      sendError(server, ctx, BasedErrorCode.FunctionIsStream, {
        route,
        requestId: id,
      })
    }
    sendError(server, ctx, BasedErrorCode.FunctionIsObservable, {
      route,
      requestId: id,
    })
    return null
  }

  // @ts-ignore fixed by checking the routes
  return route
}
