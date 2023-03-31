import { BasedServer } from '../server'
import { Context } from '@based/functions'
import { verifyRoute } from '../verifyRoute'
import { installFn } from '../installFn'
import { BasedErrorCode, createError } from '../error'

export const publish = (
  server: BasedServer,
  name: string,
  ctx: Context,
  id: number,
  payload: any,
  msg: any
) => {
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
  installFn(server, server.client.ctx, route).then((fn) => {
    if (fn === null) {
      return
    }
    try {
      return fn.publisher(server.client, payload, msg, id, ctx)
    } catch (err) {
      // Will emit the error
      createError(server, ctx, BasedErrorCode.FunctionError, {
        err,
        route,
      })
    }
  })
}
