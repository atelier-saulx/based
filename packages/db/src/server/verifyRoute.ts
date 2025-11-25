import {
  Context,
  isClientContext,
  BasedRoute,
  isBasedRoute,
  BasedFunctionTypes,
} from '../functions/index.js'
import { sendSimpleError } from './sendError.js'
import { createError } from './error/index.js'
import { BasedServer } from './server.js'
import { BasedErrorCode } from '../errors/index.js'

export const verifyRoute = <T extends BasedFunctionTypes>(
  server: BasedServer,
  ctx: Context = server.client.ctx,
  type: T,
  route: BasedRoute | null,
  name: string,
  id?: number,
): BasedRoute<T> | null => {
  if (!ctx.session) {
    return null
  }

  if (!route) {
    if (!isClientContext(ctx)) {
      throw createError(server, ctx, BasedErrorCode.FunctionNotFound, {
        route: {
          name,
          type: 'function',
        },
      })
    }
    sendSimpleError(
      server,
      ctx,
      BasedErrorCode.FunctionNotFound,
      { name, type },
      id,
    )
    return null
  }

  if (route.internalOnly === true && isClientContext(ctx)) {
    sendSimpleError(
      server,
      ctx,
      BasedErrorCode.FunctionNotFound,
      { name, type },
      id,
    )
    return null
  }

  if (!isBasedRoute(type, route)) {
    if (!isClientContext(ctx)) {
      throw createError(server, ctx, BasedErrorCode.FunctionIsWrongType, {
        route,
        observableId: id,
      })
    }
    sendSimpleError(
      server,
      ctx,
      BasedErrorCode.FunctionIsWrongType,
      { name, type },
      id,
    )
    return null
  }

  // @ts-ignore fixed by checking the routes
  return route
}
