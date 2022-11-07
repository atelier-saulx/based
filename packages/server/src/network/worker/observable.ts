import { isObservableFunctionSpec } from '../../functions'
import { BasedServer } from '../../server'
import {
  create,
  unsubscribeWorker,
  destroy,
  subscribeWorker,
} from '../../observable'
import { BasedErrorCode } from '../../error'
import { sendError } from './send'
import { BasedFunctionRoute, WorkerClient } from '../../types'

export const enableSubscribe = (
  server: BasedServer,
  client: WorkerClient,
  id: number,
  name: string,
  payload: any,
  route: BasedFunctionRoute
) => {
  if (!client.worker.nestedObservers.has(id)) {
    destroy(server, id)
    return
  }

  if (server.activeObservablesById.has(id)) {
    subscribeWorker(server, id, 0, client)
  } else {
    server.functions
      .install(name)
      .then((spec) => {
        if (spec && isObservableFunctionSpec(spec)) {
          if (!client.worker.nestedObservers.has(id)) {
            destroy(server, id)
            return
          }

          create(server, name, id, payload)
          subscribeWorker(server, id, 0, client)
        } else {
          sendError(server, client, BasedErrorCode.FunctionNotFound, route)
        }
      })
      .catch(() => {
        sendError(server, client, BasedErrorCode.FunctionNotFound, route)
      })
  }
}

export const subscribe = (
  name: string,
  payload: any,
  id: number,
  client: WorkerClient,
  server: BasedServer
) => {
  const route = server.functions.route(name)

  if (!route || !route.observable) {
    return false
  }

  client.worker.nestedObservers.add(id)

  server.auth
    .authorize(client.context, name, payload)
    .then((ok) => {
      if (!ok) {
        sendError(server, client, BasedErrorCode.AuthorizeRejectedError, route)
        return false
      }

      enableSubscribe(server, client, id, name, payload, route)
    })
    .catch((err) => {
      sendError(server, client, BasedErrorCode.AuthorizeFunctionError, {
        route,
        observableId: id,
        err,
      })
      destroy(server, id)
    })

  return true
}

export const unsubscribe = (
  client: WorkerClient,
  id: number,
  server: BasedServer
) => {
  unsubscribeWorker(server, id, client)
}
