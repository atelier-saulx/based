import { BasedServer } from '../../server'
import {
  createObs,
  unsubscribeWorker,
  destroyObs,
  subscribeWorker,
  hasObs,
} from '../../observable'
import { BasedErrorCode } from '../../../error'
import {
  BasedFunctionRoute,
  WorkerClient,
  isObservableFunctionSpec,
} from '../../../types'
import { sendError } from './send'

const enableSubscribe = (
  server: BasedServer,
  client: WorkerClient,
  id: number,
  name: string,
  payload: any,
  route: BasedFunctionRoute
) => {
  if (hasObs(server, id)) {
    subscribeWorker(server, id, client)
  } else {
    server.functions
      .install(name)
      .then((spec) => {
        if (spec && isObservableFunctionSpec(spec)) {
          if (!client.worker.nestedObservers.has(id)) {
            destroyObs(server, id)
            return
          }
          if (hasObs(server, id)) {
            subscribeWorker(server, id, client)
          } else {
            createObs(server, name, id, payload)
            subscribeWorker(server, id, client)
          }
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
  enableSubscribe(server, client, id, name, payload, route)
  return true
}

export const unsubscribe = (
  client: WorkerClient,
  id: number,
  server: BasedServer
) => {
  unsubscribeWorker(server, id, client)
}
