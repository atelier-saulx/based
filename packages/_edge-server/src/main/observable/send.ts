import { ActiveObservable, WebsocketClient, HttpClient } from '../../types'
import { updateId } from '../../protocol'
import { BasedServer } from '../server'
import { destroyObs } from './destroy'
import { BasedErrorCode, BasedError } from '../../error'
import { sendError } from '../sendError'

export const sendObsWs = (
  client: WebsocketClient,
  buffer: Uint8Array,
  obs: ActiveObservable
) => {
  if (!client.ws) {
    return
  }
  if (obs.reusedCache) {
    const prevId = updateId(buffer, obs.id)
    client.ws.send(buffer, true, false)
    buffer.set(prevId, 4)
  } else {
    client.ws.send(buffer, true, false)
  }
}

export const sendObsGetError = (
  server: BasedServer,
  client: WebsocketClient | HttpClient,
  id: number,
  name: string,
  err: BasedError<BasedErrorCode.ObservableFunctionError>
) => {
  sendError(server, client, err.code, {
    observableId: id,
    route: {
      name,
    },
    err: err,
  })
  destroyObs(server, id)
}
