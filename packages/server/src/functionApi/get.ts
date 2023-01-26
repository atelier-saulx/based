import { BasedServer } from '../server'
import { BasedErrorCode, createError, BasedErrorData } from '../error'
import { Context } from '../context'
import { BasedFunctionRoute, isObservableFunctionSpec } from '../functions'
import {
  genObservableId,
  hasObs,
  createObs,
  subscribeNext,
  getObs,
} from '../observable'

const getObsData = (
  resolve: (x: any) => any,
  reject: (err: BasedErrorData<BasedErrorCode.ObservableFunctionError>) => void,
  server: BasedServer,
  id: number,
  ctx: Context,
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
  ctx: Context,
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

    if (route.query === false) {
      reject(
        createError(server, ctx, BasedErrorCode.FunctionIsNotObservable, {
          name,
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
              createError(server, ctx, BasedErrorCode.FunctionIsNotObservable, {
                name,
              })
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
}
