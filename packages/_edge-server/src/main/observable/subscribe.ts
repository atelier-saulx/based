import { BasedServer } from '../server'
import { ActiveObservable, WebsocketClient, WorkerClient } from '../../types'
import { extendCache } from './extendCache'
import { BasedError, BasedErrorCode } from '../../error'
import { sendObsWs } from './send'
import { getObs } from './get'
import { sendError } from '../sendError'
import { sendToWorker } from '../worker'
import { IncomingType } from '../../worker/types'

export const subscribeWs = (
  server: BasedServer,
  id: number,
  checksum: number,
  client: WebsocketClient
) => {
  if (!client.ws) {
    return
  }

  client.ws.subscribe(String(id))
  const obs = getObs(server, id)

  client.ws.obs.add(id)
  obs.clients.add(client.ws.id)

  if (obs.error) {
    sendError(server, client, obs.error.code, {
      err: obs.error,
      observableId: id,
      route: {
        name: obs.name,
      },
    })
    return
  }

  if (obs.cache && obs.checksum !== checksum) {
    if (obs.diffCache && obs.previousChecksum === checksum) {
      sendObsWs(client, obs.diffCache, obs)
    } else {
      sendObsWs(client, obs.cache, obs)
    }
  }
}

export const subscribeWorker = (
  server: BasedServer,
  id: number,
  client: WorkerClient
) => {
  const obs = getObs(server, id)
  obs.workers.add(client.worker)
  if (obs.cache) {
    sendToWorker(client.worker, {
      type: IncomingType.UpdateObservable,
      id,
      checksum: obs.checksum,
      data: obs.cache,
      isDeflate: obs.isDeflate,
      diff: obs.diffCache,
      previousChecksum: obs.previousChecksum,
    })
  }
}

export const subscribeNext = (
  obs: ActiveObservable,
  onNext: (err?: BasedError<BasedErrorCode.ObservableFunctionError>) => void
) => {
  extendCache(obs)
  if (!obs.onNextData) {
    obs.onNextData = new Set()
  }
  obs.onNextData.add(onNext)
}