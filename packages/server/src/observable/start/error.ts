import { ActiveObservable } from '../types'
import { BasedServer } from '../../server'
import { BasedErrorCode, BasedErrorData, createError } from '../../error'
import { encodeErrorResponse, valueToBuffer } from '../../protocol'

export const errorListener = (
  server: BasedServer,
  obs: ActiveObservable,
  err: Error | BasedErrorData<BasedErrorCode.ObservableFunctionError>
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
          { session: { type: 'query', id: obs.id, name: obs.name } },
          BasedErrorCode.ObservableFunctionError,
          {
            err,
            observableId: obs.id,
            route: {
              name: obs.name,
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

  if (obs.functionObserveClients.size) {
    obs.functionObserveClients.forEach((fnUpdate) => {
      fnUpdate(
        obs.cache,
        obs.checksum,
        obs.diffCache,
        obs.previousChecksum,
        obs.isDeflate,
        obs.rawData,
        obs.error
      )
    })
  }

  if (obs.onNextData) {
    const onNextData = obs.onNextData
    delete obs.onNextData
    onNextData.forEach((fn) => fn(obs.error))
  }
}
