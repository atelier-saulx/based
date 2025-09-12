import { BasedServer } from '../server.js'
import { createError } from '../error/index.js'
import { Context } from '@based/functions'
import { verifyRoute } from '../verifyRoute.js'
import {
  hasObs,
  createObs,
  ObservableUpdateFunction,
  ObserveErrorListener,
  subscribeFunction,
  unsubscribeFunction,
  AttachedCtx,
} from '../query/index.js'
import { installFn } from '../installFn.js'
import { BasedErrorCode } from '@based/errors'
import { genObserveId } from '@based/protocol/client-server'
import { attachCtx, attachCtxInternal } from '../query/attachCtx.js'

export const observe = (
  server: BasedServer,
  name: string,
  ctx: Context,
  payload: any,
  update: ObservableUpdateFunction,
  error: ObserveErrorListener,
  attachedCtxInput?: { [key: string]: any },
): (() => void) => {
  let id = genObserveId(name, payload)

  const route = verifyRoute(
    server,
    server.client.ctx,
    'query',
    server.functions.route(name),
    name,
    id,
  )

  let attachedCtx: AttachedCtx
  if (attachedCtxInput) {
    attachedCtx = attachCtxInternal(attachedCtxInput, id)
    id = attachedCtx.id
  }

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
      createObs({ server, route, id, payload, ctx, spec, attachedCtx })
    }
    subscribeFunction(server, id, update)
  })

  return close
}
