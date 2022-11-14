import { sendToWorker } from './send'
import { IncomingType } from '../../worker/types'
import {
  BasedFunctionSpec,
  BasedWorker,
  ClientContext,
  HttpMethod,
} from '../../types'
import { BasedServer } from '../server'

const execFunction = (
  selectedWorker: BasedWorker,
  server: BasedServer,
  listenerId: number
): Promise<Uint8Array> => {
  return new Promise((resolve, reject) => {
    server.functions.workerResponseListeners.set(listenerId, (err, p) => {
      server.functions.workerResponseListeners.delete(listenerId)
      selectedWorker.activeFunctions--
      if (
        selectedWorker.activeFunctions <
        server.functions.lowestWorker.activeFunctions
      ) {
        server.functions.lowestWorker = selectedWorker
      }
      if (err) {
        reject(err)
      } else {
        resolve(p)
      }
    })
    selectedWorker.activeFunctions++
    let next = selectedWorker.index + 1
    if (next >= server.functions.workers.length) {
      next = 0
    }
    if (
      selectedWorker.activeFunctions >
      server.functions.workers[next].activeFunctions
    ) {
      server.functions.lowestWorker = server.functions.workers[next]
    }
  })
}

const getListenerId = (server: BasedServer): number => {
  const listenerId = ++server.functions.reqId
  // max concurrent execution is 1 mil...
  if (server.functions.workerResponseListeners.size >= 1e6) {
    // TODO: handle better Make into a based error! also needs to be stored!
    throw new Error('MAX CONCURRENT SERVER FUNCTION EXECUTION REACHED (1 MIL)')
  }
  if (server.functions.reqId > 1e6) {
    server.functions.reqId = 0
  }
  return listenerId
}

export const sendHttpFunction = async (
  server: BasedServer,
  method: HttpMethod.Get | HttpMethod.Post,
  context: ClientContext,
  spec: BasedFunctionSpec,
  payload?: any
) => {
  const id = getListenerId(server)
  const selectedWorker: BasedWorker = server.functions.lowestWorker
  sendToWorker(selectedWorker, {
    type: IncomingType.HttpFunction,
    method,
    id,
    context,
    payload,
    name: spec.name,
    path: spec.functionPath,
  })
  return execFunction(selectedWorker, server, id)
}

export const sendWsFunction = async (
  server: BasedServer,
  context: ClientContext,
  spec: BasedFunctionSpec,
  reqId: number,
  isDeflate: boolean,
  payload?: any
) => {
  const id = getListenerId(server)
  const selectedWorker: BasedWorker = server.functions.lowestWorker
  sendToWorker(selectedWorker, {
    type: IncomingType.WsFunction,
    isDeflate,
    id,
    reqId,
    context,
    payload,
    name: spec.name,
    path: spec.functionPath,
  })
  return execFunction(selectedWorker, server, id)
}
