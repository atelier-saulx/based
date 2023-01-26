import { BasedServer } from '../server'
import { BasedErrorCode, createError } from '../error'
import { Context } from '../context'
import { isObservableFunctionSpec } from '../functions'

export const callFunction = async (
  server: BasedServer,
  name: string,
  ctx: Context,
  payload: any
): Promise<any> => {
  const route = server.functions.route(name)

  if (!route) {
    throw createError(server, ctx, BasedErrorCode.FunctionNotFound, { name })
  }

  if (route.query === true) {
    throw createError(server, ctx, BasedErrorCode.FunctionIsObservable, {
      name,
    })
  }

  const fn = await server.functions.install(name)

  if (!fn) {
    throw createError(server, ctx, BasedErrorCode.FunctionNotFound, { name })
  }

  if (isObservableFunctionSpec(fn)) {
    throw createError(server, ctx, BasedErrorCode.FunctionIsObservable, {
      name,
    })
  }

  try {
    return fn.function(payload, ctx)
  } catch (err) {
    throw createError(server, ctx, BasedErrorCode.FunctionError, {
      route: { name },
      err,
    })
  }
}
