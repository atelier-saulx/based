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
  isChannelFunctionRoute,
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

    sendError(
      server,
      ctx,
      BasedErrorCode.FunctionNotFound,
      type === 'channel'
        ? {
            route: { name },
            channelId: id,
          }
        : type === 'query'
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
        throw createError(server, ctx, BasedErrorCode.FunctionIsWrongType, {
          route,
          observableId: id,
        })
      }
      sendError(server, ctx, BasedErrorCode.FunctionIsWrongType, {
        route: { name },
        observableId: id,
      })
      return null
    }
  }

  if (type === 'stream') {
    if (!isStreamFunctionRoute(route)) {
      if (!isClientContext(ctx)) {
        throw createError(server, ctx, BasedErrorCode.FunctionIsWrongType, {
          route,
          requestId: id,
        })
      }
      sendError(server, ctx, BasedErrorCode.FunctionIsWrongType, {
        route: { name },
        requestId: id,
      })
      return null
    }
  }

  if (type === 'channel') {
    if (!isChannelFunctionRoute(route)) {
      if (!isClientContext(ctx)) {
        throw createError(server, ctx, BasedErrorCode.FunctionIsWrongType, {
          route,
          channelId: id,
        })
      }
      sendError(server, ctx, BasedErrorCode.FunctionIsWrongType, {
        route: { name },
        channelId: id,
      })
      return null
    }
  }

  if (type === 'fn' && !isFunctionRoute(route)) {
    if (!isClientContext(ctx)) {
      throw createError(server, ctx, BasedErrorCode.FunctionIsWrongType, {
        route,
        requestId: id,
      })
    }
    sendError(server, ctx, BasedErrorCode.FunctionIsWrongType, {
      route,
      requestId: id,
    })
    return null
  }

  // @ts-ignore fixed by checking the routes
  return route
}
