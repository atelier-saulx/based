import { BasedServer } from '../server'
import { BasedErrorCode, createError } from '../error'
import { Context } from '@based/functions'
import { verifyRoute } from '../verifyRoute'
import { installFn } from '../installFn'

export const callFunction = async (
  server: BasedServer,
  name: string,
  ctx: Context,
  payload: any
): Promise<any> => {
  const route = verifyRoute(
    server,
    server.client.ctx,
    'function',
    server.functions.route(name),
    name
  )

  if (route === null) {
    return
  }

  const fn = await installFn(server, server.client.ctx, route)

  if (!fn) {
    throw createError(server, ctx, BasedErrorCode.FunctionNotFound, {
      route,
    })
  }

  try {
    return fn.fn(server.client, payload, ctx)
  } catch (err) {
    throw createError(server, ctx, BasedErrorCode.FunctionError, {
      route,
      err,
    })
  }
}
