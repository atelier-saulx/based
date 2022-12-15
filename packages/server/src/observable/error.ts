import { BasedServer } from '../server'
import { destroyObs } from './destroy'
import { WebsocketClient, HttpClient } from '../client'
import { BasedErrorCode, BasedError } from '../error'
import { sendError } from '../sendError'

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
