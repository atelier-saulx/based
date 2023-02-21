import { BasedServer } from '../server'
import { BasedErrorCode, createError } from '../error'
import { Context } from '@based/functions'
import { verifyRoute } from '../verifyRoute'
import { installFn } from '../installFn'

export const publish = async (
  server: BasedServer,
  name: string,
  ctx: Context,
  id: number,
  payload: any,
  msg: any
): Promise<any> => {
  const route = verifyRoute(
    server,
    server.client.ctx,
    'channel',
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
    return fn.publish(server.client, payload, msg, id, ctx)
  } catch (err) {
    throw createError(server, ctx, BasedErrorCode.FunctionError, {
      route,
      err,
    })
  }
}
