import { ActiveObservable, ObservableError } from '../types'
import { BasedServer } from '../../server'
import { createError, BasedErrorCode } from '../../error'
import { encodeErrorResponse, valueToBuffer } from '../../protocol'

export const errorListener = (
  server: BasedServer,
  obs: ActiveObservable,
  err: Error | ObservableError
) => {
  delete obs.cache
  delete obs.diffCache
  delete obs.checksum
  delete obs.previousChecksum

  obs.isDeflate = false
  obs.reusedCache = false

  obs.error =
    err instanceof Error
      ? createError(
          server,
          {
            session: { type: 'query', id: obs.id, name: obs.name, headers: {} },
          },
          BasedErrorCode.FunctionError,
          {
            err,
            observableId: obs.id,
            route: {
              name: obs.name,
              type: 'query',
            },
          }
        )
      : err.observableId !== obs.id
      ? { ...err, observableId: obs.id }
      : err

  if (obs.clients.size) {
    server.uwsApp.publish(
      String(obs.id),
      encodeErrorResponse(valueToBuffer(obs.error)),
      true,
      false
    )
  }

  // TODO: Change this make it one error handler
  if (obs.functionObserveClients.size) {
    obs.functionObserveClients.forEach((fnUpdate) => {
      fnUpdate(
        obs.rawData,
        obs.checksum,
        obs.error,
        obs.cache,
        obs.diffCache,
        obs.previousChecksum,
        obs.isDeflate
      )
    })
  }

  if (obs.onNextData) {
    const onNextData = obs.onNextData
    delete obs.onNextData
    onNextData.forEach((fn) => fn(obs.error))
  }
}