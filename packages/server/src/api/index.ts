import { BasedServer } from '../server'
import { BasedErrorCode, createError } from '../error'
import { ClientContext } from '../client'
import { BasedFunctionRoute, isObservableFunctionSpec } from '../functions'
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

const getObsData = (
  resolve: (x) => any,
  reject: (err) => void,
  server: BasedServer,
  id: number,
  ctx: ClientContext,
  route: BasedFunctionRoute
) => {
  const obs = getObs(server, id)
  if (obs.error) {
    reject(
      createError(server, ctx, BasedErrorCode.ObservableFunctionError, {
        route,
        observableId: id,
        err: obs.error,
      })
    )
    return
  }
  if (obs.cache) {
    resolve(obs.rawData || obs.cache)
    return
  }
  subscribeNext(obs, (err) => {
    if (err) {
      reject(
        createError(server, ctx, BasedErrorCode.ObservableFunctionError, {
          observableId: id,
          route,
          err,
        })
      )
    } else {
      resolve(obs.rawData || obs.cache)
    }
  })
}

export const get = (
  server: BasedServer,
  name: string,
  ctx: ClientContext,
  payload: any
): Promise<any> => {
  return new Promise((resolve, reject) => {
    const route = server.functions.route(name)

    if (!route) {
      reject(
        createError(server, ctx, BasedErrorCode.FunctionNotFound, { name })
      )
      return
    }

    if (route.observable === false) {
      reject(
        createError(server, ctx, BasedErrorCode.FunctionIsNotObservable, {
          name,
        })
      )
      return
    }

    // TODO: Callstack
    server.auth
      .authorize(ctx, name)
      .catch((err) => {
        reject(
          createError(server, ctx, BasedErrorCode.AuthorizeFunctionError, {
            route: { name },
            err,
          })
        )
      })
      .then((ok) => {
        if (!ok) {
          reject(
            createError(server, ctx, BasedErrorCode.AuthorizeRejectedError, {
              route: { name },
            })
          )
          return
        }
        const id = genObservableId(name, payload)
        if (!hasObs(server, id)) {
          server.functions
            .install(name)
            .then((fn) => {
              if (!fn) {
                reject(
                  createError(server, ctx, BasedErrorCode.FunctionNotFound, {
                    name,
                  })
                )
                return
              }
              if (!isObservableFunctionSpec(fn)) {
                reject(
                  createError(
                    server,
                    ctx,
                    BasedErrorCode.FunctionIsNotObservable,
                    {
                      name,
                    }
                  )
                )
                return
              }
              if (!hasObs(server, id)) {
                createObs(server, name, id, payload)
              }
              getObsData(resolve, reject, server, id, ctx, route)
            })
            .catch(() =>
              reject(
                createError(server, ctx, BasedErrorCode.FunctionNotFound, {
                  name,
                })
              )
            )
        } else {
          getObsData(resolve, reject, server, id, ctx, route)
        }
      })
  })
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

export { decode } from '../protocol'

// TODO: nested stream function
