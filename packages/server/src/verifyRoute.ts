import { Context, isClientContext } from '@based/functions'
import {
  BasedFunctionRoute,
  BasedQueryFunctionRoute,
  BasedRoute,
  BasedStreamFunctionRoute,
  isQueryFunctionRoute,
  isStreamFunctionRoute,
  isFunctionRoute,
  BasedChannelFunctionRoute,
} from './functions'
import { sendError } from './sendError'
import { BasedErrorCode, createError } from './error'
import { BasedServer } from './server'

type FnType = 'query' | 'stream' | 'fn' | 'channel'

export const verifyRoute = <T extends FnType>(
  server: BasedServer,
  ctx: Context = server.client.ctx,
  type: T,
  route: BasedRoute | null,
  name: string,
  id?: number
):
  | (T extends 'channel'
      ? BasedChannelFunctionRoute
      : T extends 'query'
      ? BasedQueryFunctionRoute
      : T extends 'stream'
      ? BasedStreamFunctionRoute
      : BasedFunctionRoute)
  | null => {
  if (!ctx.session) {
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

    if (type === 'channel') {
      // tmp
      return null
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
          observableId: id,
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
          requestId: id,
        })
      }
      sendError(server, ctx, BasedErrorCode.FunctionIsNotStream, {
        route: { name },
        requestId: id,
      })
      return null
    }
  }

  if (type === 'channel') {
    // lulllz TODO: proper error handling!
  }

  if (type === 'fn' && !isFunctionRoute(route)) {
    if (!isClientContext(ctx)) {
      if (isStreamFunctionRoute(route)) {
        throw createError(server, ctx, BasedErrorCode.FunctionIsNotStream, {
          route,
          requestId: id,
        })
      }
      throw createError(server, ctx, BasedErrorCode.FunctionIsObservable, {
        route,
        requestId: id,
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