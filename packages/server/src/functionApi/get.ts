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
import { installFn } from '../installFn.js'
import { BasedErrorCode, BasedErrorData } from '@based/errors'
import { BasedQuery } from './client/query.js'

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

export const get = (query: BasedQuery): Promise<any> => {
  return new Promise((resolve, reject) => {
    const attachedCtx = query.attachedCtx
    const id = attachedCtx ? attachedCtx.id : query.id
    const server = query.ctx.session.client.server
    const route = query.route
    const ctx = query.ctx
    const payload = query.payload
    if (!hasObs(server, id)) {
      installFn({ server, ctx, route }).then((spec) => {
        if (!spec) {
          reject(
            createError(server, query.ctx, BasedErrorCode.FunctionNotFound, {
              route,
            }),
          )
          return
        }
        if (!hasObs(server, id)) {
          createObsNoStart({
            server,
            route,
            id,
            payload,
            ctx,
            spec,
            attachedCtx,
          })
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
