import { BasedServer } from './server.js'
import {
  Context,
  isClientContext,
  BasedRoute,
  BasedFunctionConfig,
  isBasedFunctionConfig,
  BasedFunctionTypes,
} from '@based/functions'
import { sendSimpleError } from './sendError.js'
import { BasedErrorCode } from '@based/errors'

const functionNotFound = (
  server: BasedServer,
  ctx: Context,
  route: BasedRoute,
  _type?: BasedFunctionTypes,
  id?: number,
) => {
  if (!isClientContext(ctx)) {
    return
  }
  sendSimpleError(
    server,
    ctx,
    BasedErrorCode.FunctionNotFound,
    { type: route.type, name: route.name },
    id,
  )
}

// make this a function hander as well
export const installFn = async <R extends BasedRoute>(
  server: BasedServer,
  ctx: Context,
  route: R,
  id?: number,
): Promise<null | BasedFunctionConfig<R['type']>> => {
  if (!route) {
    return null
  }

  const { type, name } = route
  try {
    const spec = await server.functions.install(name)
    if (!ctx.session) {
      return null
    }

    if (spec === null) {
      functionNotFound(server, ctx, route, type, id)
      return null
    }

    if (!isBasedFunctionConfig(type, route)) {
      if (!isClientContext(ctx)) {
        return null
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

    // @ts-ignore Fixed by chekcing the specs
    return spec
  } catch (err) {
    functionNotFound(server, ctx, route, type, id)
  }
  return null
}
