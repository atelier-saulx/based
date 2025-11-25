import { BasedServer } from '../server.js'
import { createError } from '../error/index.js'
import { verifyRoute } from '../verifyRoute.js'
import { installFn } from '../installFn.js'
import { BasedErrorCode } from '../../errors/index.js'
import type { Context } from '../../functions/index.js'

export const callFunction = async (
  server: BasedServer,
  name: string,
  ctx: Context,
  payload: any,
): Promise<any> => {
  const route = verifyRoute(
    server,
    server.client.ctx,
    'function',
    server.functions.route(name),
    name,
  )

  if (route === null) {
    return
  }

  const spec = await installFn({ server, ctx: server.client.ctx, route })

  if (!spec) {
    throw createError(server, ctx, BasedErrorCode.FunctionNotFound, {
      route,
    })
  }

  if (spec.relay) {
    const client = server.clients[spec.relay.client]
    if (!client) {
      throw createError(server, ctx, BasedErrorCode.FunctionError, {
        route,
        err: new Error('Cannot find client ' + spec.relay),
      })
    }
    try {
      return client.call(spec.relay.target ?? spec.name, payload)
    } catch (err) {
      throw createError(server, ctx, BasedErrorCode.FunctionError, {
        route,
        err,
      })
    }
  }

  try {
    return spec.fn!(server.client, payload, ctx)
  } catch (err) {
    throw createError(server, ctx, BasedErrorCode.FunctionError, {
      route,
      err,
    })
  }
}
