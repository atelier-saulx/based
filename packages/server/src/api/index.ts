import { BasedServer } from '../server'
import { BasedErrorCode, createError } from '../error'
import { ClientContext } from '../client'
import { isObservableFunctionSpec } from '../functions'
import {
  ActiveObservable,
  genObservableId,
  hasObs,
  createObs,
  subscribeNext,
  ObservableUpdateFunction,
  ObserveErrorListener,
  subscribeFunction,
  getObs,
  unsubscribeFunction,
} from '../observable'
import { resolve } from 'path'

export const runFunction = async (
  server: BasedServer,
  name: string,
  ctx: ClientContext,
  payload: any
): Promise<any> => {
  const route = server.functions.route(name)

  if (!route) {
    throw createError(server, ctx, BasedErrorCode.FunctionNotFound, { name })
  }

  if (route.observable === true) {
    throw createError(server, ctx, BasedErrorCode.FunctionIsObservable, {
      name,
    })
  }

  const fn = await server.functions.install(name)

  if (!fn) {
    throw createError(server, ctx, BasedErrorCode.FunctionNotFound, { name })
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

export const get = async (
  server: BasedServer,
  name: string,
  ctx: ClientContext,
  payload: any
): Promise<any> => {
  const route = server.functions.route(name)

  if (!route) {
    throw createError(server, ctx, BasedErrorCode.FunctionNotFound, { name })
  }

  if (route.observable === false) {
    throw createError(server, ctx, BasedErrorCode.FunctionIsNotObservable, {
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

    const id = genObservableId(name, payload)

    if (!hasObs(server, id)) {
      const fn = await server.functions.install(name)
      if (!fn) {
        throw createError(server, ctx, BasedErrorCode.FunctionNotFound, {
          name,
        })
      }
      if (!isObservableFunctionSpec(fn)) {
        throw createError(server, ctx, BasedErrorCode.FunctionIsNotObservable, {
          name,
        })
      }
      createObs(server, name, id, payload)
    }

    const obs = getObs(server, id)
    if (obs.error) {
      throw createError(server, ctx, BasedErrorCode.ObservableFunctionError, {
        route,
        observableId: id,
        err: obs.error,
      })
    }
    if (obs.cache) {
      resolve(obs.cache)
      sendGetData(server, id, obs, checksum, client)
      return
    }
    subscribeNext(obs, (err) => {
      if (err) {
        sendObsGetError(server, client, id, name, err)
      } else {
        sendGetData(server, id, obs, checksum, client)
      }
    })

    // return fn.function(payload, ctx)
  } catch (err) {
    throw createError(server, ctx, BasedErrorCode.AuthorizeFunctionError, {
      route: { name },
      err,
    })
  }
}

export const observe = (
  server: BasedServer,
  name: string,
  ctx: ClientContext, // call this ctx with ctx.session for client
  payload: any,
  update: ObservableUpdateFunction,
  error: ObserveErrorListener
): (() => void) => {
  // TODO: Callstack

  const route = server.functions.route(name)

  if (!route) {
    throw createError(server, ctx, BasedErrorCode.FunctionNotFound, { name })
  }

  if (route.observable !== true) {
    throw createError(server, ctx, BasedErrorCode.FunctionIsNotObservable, {
      name,
    })
  }

  const id = genObservableId(name, payload)
  let obs: ActiveObservable
  let isClosed = false

  const close = () => {
    if (isClosed) {
      return
    }
    isClosed = true
    if (obs) {
      unsubscribeFunction(server, id, update)
    }
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

// TODO: nested stream function
