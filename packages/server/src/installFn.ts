import {
  BasedRoute,
  BasedSpec,
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
  id?: number
) => {
  if (!isClientContext(ctx)) {
    return
  }
  if (isQuery) {
    sendError(server, ctx, BasedErrorCode.FunctionNotFound, {
      route,
      requestId: id,
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
  try {
    const spec = await server.functions.install(route.name)
    if (!ctx.session) {
      return null
    }
    if (spec === false) {
      functionNotFound(server, ctx, route, isQuery, id)
      return null
    }

    if (isQuery && !isQueryFunctionSpec(spec)) {
      if (!isClientContext(ctx)) {
        return null
      }
      sendError(server, ctx, BasedErrorCode.FunctionIsNotObservable, {
        route,
        observableId: id,
      })
      return null
    }
    if (isStream && !isStreamFunctionSpec(spec)) {
      if (!isClientContext(ctx)) {
        return null
      }
      if (isQueryFunctionSpec(spec)) {
        sendError(
          server,
          ctx,
          BasedErrorCode.CannotStreamToObservableFunction,
          {
            route,
            requestId: id,
          }
        )
        return null
      }
      sendError(server, ctx, BasedErrorCode.FunctionIsNotStream, {
        route,
        requestId: id,
      })
      return null
    }
    if (!isStream && !isQuery) {
      if (isQueryFunctionSpec(spec)) {
        if (!isClientContext(ctx)) {
          return null
        }
        sendError(server, ctx, BasedErrorCode.FunctionIsObservable, {
          route,
          requestId: id,
        })
        return null
      }
      if (isStreamFunctionSpec(spec)) {
        if (!isClientContext(ctx)) {
          return null
        }
        sendError(server, ctx, BasedErrorCode.FunctionIsStream, {
          route,
          requestId: id,
        })
        return null
      }
    }
    // @ts-ignore fixed by chekcing the specs
    return spec
  } catch (err) {
    functionNotFound(server, ctx, route, isQuery, id)
  }
  return null
}
