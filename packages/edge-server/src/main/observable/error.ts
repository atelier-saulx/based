import { BasedServer } from '../server'
import { destroy } from './destroy'
import { WebsocketClient, HttpClient } from '../../types'
import { BasedErrorCode, BasedError, sendError } from '../error'

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
  destroy(server, id)
}
