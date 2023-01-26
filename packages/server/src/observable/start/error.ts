import { ActiveObservable } from '../types'
import { BasedServer } from '../../server'
import { BasedErrorCode, createError } from '../../error'
import { encodeErrorResponse, valueToBuffer } from '../../protocol'

export const errorListener = (
  server: BasedServer,
  obs: ActiveObservable,
  err
) => {
  obs.error = err
  delete obs.cache
  delete obs.diffCache
  delete obs.checksum
  delete obs.previousChecksum

  obs.isDeflate = false
  obs.reusedCache = false

  const errorData = createError(
    server,
    { session: { type: 'observable', id: obs.id, name: obs.name } },
    BasedErrorCode.ObservableFunctionError,
    {
      err,
      observableId: obs.id,
      route: {
        name: obs.name,
      },
    }
  )

  if (obs.clients.size) {
    server.uwsApp.publish(
      String(obs.id),
      encodeErrorResponse(valueToBuffer(errorData)),
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
        errorData
      )
    })
  }

  if (obs.onNextData) {
    const onNextData = obs.onNextData
    delete obs.onNextData
    onNextData.forEach((fn) => fn(err))
  }
}
