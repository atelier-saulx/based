import { ActiveObservable, ObservableError } from '../types.js'
import { BasedServer } from '../../server.js'
import { createError } from '../../error/index.js'
import {
  encodeErrorResponse,
  valueToBuffer,
  valueToBufferV1,
} from '../../protocol.js'
import { BasedErrorCode } from '../../../errors/index.js'

export const errorListener = (
  server: BasedServer,
  obs: ActiveObservable,
  err: Error | ObservableError,
) => {
  delete obs.cache
  delete obs.diffCache
  delete obs.checksum
  delete obs.previousChecksum

  obs.isDeflate = false
  obs.reusedCache = false

  const id = obs.attachedCtx ? obs.attachedCtx.fromId : obs.id

  obs.error =
    err instanceof Error
      ? createError(
          server,
          {
            session: {
              type: 'query',
              id,
              name: obs.route.name,
              headers: {},
            },
          },
          BasedErrorCode.FunctionError,
          {
            err,
            observableId: id,
            route: {
              name: obs.route.name,
              type: 'query',
            },
          },
        )
      : err.observableId !== id
        ? { ...err, observableId: id }
        : err

  if (obs.clients.size) {
    server.uwsApp.publish(
      String(id),
      encodeErrorResponse(valueToBuffer(obs.error, true)),
      true,
      false,
    )
  }

  if (obs.oldClients?.size) {
    server.uwsApp.publish(
      String(id) + '-v1',
      encodeErrorResponse(valueToBufferV1(obs.error, true)),
      true,
      false,
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
        obs.isDeflate,
      )
    })
  }

  if (obs.onNextData) {
    const onNextData = obs.onNextData
    delete obs.onNextData
    onNextData.forEach((fn) => fn(obs.error!))
  }
}
