import { BasedServer } from '../server'
import { BasedErrorCode, createError, BasedErrorData } from '../error'
import { Context } from '@based/functions'
import { BasedFunctionRoute, BasedQueryFunctionRoute } from '../functions'
import {
  genObservableId,
  hasObs,
  createObs,
  subscribeNext,
  getObs,
  destroyObs,
  start,
} from '../observable'
import { verifyRoute } from '../verifyRoute'
import { installFn } from '../installFn'

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
        err: obs.error.message,
      })
    )
    return
  }
  if (obs.cache) {
    resolve(obs.rawData || obs.cache)
    return
  }
  subscribeNext(obs, (err) => {
    destroyObs(server, id)
    if (err) {
      reject(err)
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
    let route: BasedQueryFunctionRoute
    try {
      route = verifyRoute(
        server,
        server.client.ctx,
        'query',
        server.functions.route(name),
        name
      )
      if (route === null) {
        return
      }
    } catch (err) {
      reject(err)
      return
    }
    const id = genObservableId(name, payload)
    if (!hasObs(server, id)) {
      installFn(server, server.client.ctx, route).then((spec) => {
        if (!spec) {
          reject(
            createError(server, ctx, BasedErrorCode.FunctionNotFound, {
              route,
            })
          )
          return
        }
        if (!hasObs(server, id)) {
          createObs(server, name, id, payload, true)
          getObsData(resolve, reject, server, id, ctx, route)
          start(server, id)
        } else {
          getObsData(resolve, reject, server, id, ctx, route)
        }
      })
    } else {
      getObsData(resolve, reject, server, id, ctx, route)
    }
  })
}
