import { BasedServer } from '../server.js'
import { Context } from '@based/functions'
import { verifyRoute } from '../verifyRoute.js'
import { installFn } from '../installFn.js'
import { createError } from '../error/index.js'
import { BasedErrorCode } from '@based/errors'

export const publish = (
  server: BasedServer,
  name: string,
  ctx: Context,
  id: number,
  payload: any,
  msg: any,
) => {
  const route = verifyRoute(
    server,
    server.client.ctx,
    'channel',
    server.functions.route(name),
    name,
  )
  if (route === null) {
    return
  }
  installFn({ server, ctx: server.client.ctx, route }).then((fn) => {
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
