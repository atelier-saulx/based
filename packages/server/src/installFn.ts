import {
  BasedRoute,
  BasedSpec,
  isChannelFunctionRoute,
  isChannelFunctionSpec,
  isFunctionSpec,
  isQueryFunctionRoute,
  isQueryFunctionSpec,
  isStreamFunctionRoute,
  isStreamFunctionSpec,
} from './functions'
import { BasedServer } from './server'
import { Context, isClientContext } from '@based/functions'
import { sendError } from './sendError'
import { BasedErrorCode } from './error'

const functionNotFound = (
  server: BasedServer,
  ctx: Context,
  route: BasedRoute,
  isQuery: boolean,
  isChannel: boolean,
  id?: number
) => {
  if (!isClientContext(ctx)) {
    return
  }
  if (isQuery) {
    sendError(server, ctx, BasedErrorCode.FunctionNotFound, {
      route,
      observableId: id,
    })
    return
  }
  if (isChannel) {
    sendError(server, ctx, BasedErrorCode.FunctionNotFound, {
      route,
      channelId: id,
    })
    return
  }
  sendError(server, ctx, BasedErrorCode.FunctionNotFound, {
    route,
    requestId: id,
  })
}

export const installFn = async <R extends BasedRoute>(
  server: BasedServer,
  ctx: Context,
  route: R,
  id?: number
): Promise<null | BasedSpec<R>> => {
  const isQuery = isQueryFunctionRoute(route)
  const isStream = !isQuery && isStreamFunctionRoute(route)
  const isChannel = !isStream && !isQuery && isChannelFunctionRoute(route)

  try {
    const spec = await server.functions.install(route.name)
    if (!ctx.session) {
      return null
    }

    if (spec === null) {
      functionNotFound(server, ctx, route, isQuery, isChannel, id)
      return null
    }

    if (isChannel && !isChannelFunctionSpec(spec)) {
      if (!isClientContext(ctx)) {
        return null
      }
      sendError(server, ctx, BasedErrorCode.FunctionIsWrongType, {
        route,
        observableId: id,
      })
    }

    if (isQuery && !isQueryFunctionSpec(spec)) {
      if (!isClientContext(ctx)) {
        return null
      }
      sendError(server, ctx, BasedErrorCode.FunctionIsWrongType, {
        route,
        observableId: id,
      })
      return null
    }

    if (isStream && !isStreamFunctionSpec(spec)) {
      if (!isClientContext(ctx)) {
        return null
      }
      sendError(server, ctx, BasedErrorCode.FunctionIsWrongType, {
        route,
        observableId: id,
      })
      return null
    }

    if (!isStream && !isQuery && !isChannel && !isFunctionSpec(spec)) {
      if (!isClientContext(ctx)) {
        return null
      }
      sendError(server, ctx, BasedErrorCode.FunctionIsWrongType, {
        route,
        observableId: id,
      })
      return null
    }

    // @ts-ignore Fixed by chekcing the specs
    return spec
  } catch (err) {
    functionNotFound(server, ctx, route, isQuery, isChannel, id)
  }
  return null
}
