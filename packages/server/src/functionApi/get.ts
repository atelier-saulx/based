import { BasedServer } from '../server.js'
import { createError } from '../error/index.js'
import { Context, BasedRoute } from '@based/functions'
import {
  hasObs,
  subscribeNext,
  getObsAndStopRemove,
  destroyObs,
  start,
  createObsNoStart,
} from '../query/index.js'
import { verifyRoute } from '../verifyRoute.js'
import { installFn } from '../installFn.js'
import { BasedErrorCode, BasedErrorData } from '@based/errors'
import { genObserveId } from '@based/protocol/client-server'

const getObsData = (
  resolve: (x: any) => any,
  reject: (err: BasedErrorData<BasedErrorCode.FunctionError>) => void,
  server: BasedServer,
  id: number,
  ctx: Context,
  route: BasedRoute<'query'>,
) => {
  const obs = getObsAndStopRemove(server, id)

  if (server.queryEvents) {
    server.queryEvents.get(obs)
  }

  if (obs.error) {
    reject(
      createError(server, ctx, BasedErrorCode.FunctionError, {
        route,
        observableId: id,
        err: obs.error.message,
      }),
    )
    return
  }

  if (obs.cache) {
    resolve(obs.rawData ?? obs.cache)
    return
  }

  subscribeNext(obs, (err) => {
    destroyObs(server, id)
    if (err) {
      reject(err)
    } else {
      resolve(obs.rawData ?? obs.cache)
    }
  })
}

export const get = (
  server: BasedServer,
  name: string,
  ctx: Context,
  payload: any,
): Promise<any> => {
  return new Promise((resolve, reject) => {
    // handle attached

    let route: BasedRoute<'query'>
    try {
      route = verifyRoute(
        server,
        server.client.ctx,
        'query',
        server.functions.route(name),
        name,
      )
      if (route === null) {
        reject(new Error(`[${name}] No session in ctx`))
        return
      }
    } catch (err) {
      reject(err)
      return
    }

    const id = genObserveId(name, payload)

    if (!hasObs(server, id)) {
      installFn({ server, ctx: server.client.ctx, route }).then((spec) => {
        if (!spec) {
          reject(
            createError(server, ctx, BasedErrorCode.FunctionNotFound, {
              route,
            }),
          )
          return
        }
        if (!hasObs(server, id)) {
          createObsNoStart({ server, route, id, payload, ctx, spec })
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
