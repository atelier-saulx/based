import { BasedServer } from '../server'
import { BasedErrorCode, createError } from '../error'
import { ClientContext } from '../client'
import { isObservableFunctionSpec } from '../functions'

export const runFunction = async (
  server: BasedServer,
  name: string,
  ctx: ClientContext,
  payload: any
): Promise<any> => {
  let fn = server.functions.getFromStore(name)

  if (!fn) {
    fn = await server.functions.install(name)
    if (!fn) {
      throw createError(server, ctx, BasedErrorCode.FunctionNotFound, { name })
    }
  }

  if (isObservableFunctionSpec(fn)) {
    throw createError(server, ctx, BasedErrorCode.FunctionIsObservable, {
      name,
    })
  }

  // TODO: Callstack
  try {
    const ok = await server.auth.authorize(ctx, name)
    if (!ok) {
      throw createError(server, ctx, BasedErrorCode.AuthorizeRejectedError, {
        route: { name },
      })
    }
    return fn.function(payload, ctx)
  } catch (err) {
    throw createError(server, ctx, BasedErrorCode.AuthorizeFunctionError, {
      route: { name },
      err,
    })
  }
}
