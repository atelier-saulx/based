import { createError } from '../error/index.js'
import {
  hasObs,
  createObs,
  ServerObserveErrorListener as ObserveErrorListener,
  subscribeFunction,
  unsubscribeFunction,
} from '../query/index.js'
import { installFn } from '../installFn.js'
import { BasedErrorCode } from '@based/errors'
import { BasedQuery } from './client/query.js'
import { ObservableUpdateFunction } from '@based/functions'

export const observe = (
  query: BasedQuery,
  update: ObservableUpdateFunction,
  error: ObserveErrorListener,
): (() => void) => {
  const attachedCtx = query.attachedCtx
  const id = attachedCtx ? attachedCtx.id : query.id
  const server = query.ctx.session.client.server
  const route = query.route
  const ctx = query.ctx
  const payload = query.payload

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
