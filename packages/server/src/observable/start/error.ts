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

  // FIX ERROR CODE!
  const errorData = createError(
    server,
    { headers: {}, isObservable: true, id: obs.id, name: obs.name },
    err.code || BasedErrorCode.ObservableFunctionError,
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

  // if (obs.workers.size) {
  //   obs.workers.forEach((w) => {
  //     sendToWorker(w, {
  //       type: IncomingType.UpdateObservable,
  //       id,
  //       err,
  //     })
  //   })
  // }

  if (obs.onNextData) {
    const onNextData = obs.onNextData
    delete obs.onNextData
    onNextData.forEach((fn) => fn(err))
  }
}
