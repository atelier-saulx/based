import { BasedServer } from '../server'
import { BasedErrorCode, createError } from '../error'
import { Context } from '@based/functions'
import { isObservableFunctionSpec } from '../functions'
import {
  genObservableId,
  hasObs,
  createObs,
  ObservableUpdateFunction,
  ObserveErrorListener,
  subscribeFunction,
  unsubscribeFunction,
} from '../observable'

export const observe = (
  server: BasedServer,
  name: string,
  ctx: Context,
  payload: any,
  update: ObservableUpdateFunction,
  error: ObserveErrorListener
): (() => void) => {
  const route = server.functions.route(name)

  if (!route) {
    throw createError(server, ctx, BasedErrorCode.FunctionNotFound, { name })
  }

  if (route.query !== true) {
    throw createError(server, ctx, BasedErrorCode.FunctionIsNotObservable, {
      name,
    })
  }

  const id = genObservableId(name, payload)
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

  server.functions
    .install(name)
    .then((spec) => {
      if (isClosed) {
        return
      }
      if (spec === false) {
        error(
          createError(server, ctx, BasedErrorCode.FunctionNotFound, {
            name,
          })
        )
        return
      }

      if (!isObservableFunctionSpec(spec)) {
        error(
          createError(server, ctx, BasedErrorCode.FunctionIsNotObservable, {
            name,
          })
        )
        return
      }

      if (!hasObs(server, id)) {
        createObs(server, name, id, payload)
      }

      subscribeFunction(server, id, update)
    })
    .catch(() => {
      if (isClosed) {
        return
      }
      error(
        createError(server, ctx, BasedErrorCode.FunctionNotFound, {
          name,
        })
      )
    })

  return close
}
