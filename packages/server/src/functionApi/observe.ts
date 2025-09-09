import { BasedServer } from '../server.js'
import { createError } from '../error/index.js'
import { Context } from '@based/functions'
import { verifyRoute } from '../verifyRoute.js'
import {
  genObservableId,
  hasObs,
  createObs,
  ObservableUpdateFunction,
  ObserveErrorListener,
  subscribeFunction,
  unsubscribeFunction,
} from '../query/index.js'
import { installFn } from '../installFn.js'
import { BasedErrorCode } from '@based/errors'

// handle this
export const observe = (
  server: BasedServer,
  name: string,
  ctx: Context,
  payload: any,
  update: ObservableUpdateFunction,
  error: ObserveErrorListener,
): (() => void) => {
  const id = genObservableId(name, payload)

  // handle attached

  const route = verifyRoute(
    server,
    server.client.ctx,
    'query',
    server.functions.route(name),
    name,
    id,
  )

  if (route === null) {
    throw new Error(`[${name}] No session in ctx`)
  }

  let isClosed = false

  const close = () => {
    if (isClosed) {
      return
    }
    isClosed = true
    unsubscribeFunction(server, id, update)
  }

  if (hasObs(server, id)) {
    subscribeFunction(server, id, update)
    return close
  }

  installFn({ server, ctx: server.client.ctx, route }).then((spec) => {
    if (isClosed) {
      return
    }
    if (spec === null) {
      error(
        createError(server, ctx, BasedErrorCode.FunctionNotFound, {
          route,
        }),
      )
      return
    }
    if (!hasObs(server, id)) {
      createObs({ server, route, id, payload, ctx, spec })
    }
    subscribeFunction(server, id, update)
  })

  return close
}
