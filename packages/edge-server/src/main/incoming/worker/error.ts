import { BasedWorker } from '../../../types'
import { Outgoing, OutgoingType } from '../../../worker/types'
import { BasedServer } from '../../server'
import { BasedErrorCode, createError, ErrorPayload } from '../../../error'

export default (
  server: BasedServer,
  worker: BasedWorker,
  msg: Outgoing[OutgoingType.Error]
) => {
  if (msg.code === BasedErrorCode.ObserveCallbackError) {
    const payload = <ErrorPayload[BasedErrorCode.ObserveCallbackError]>(
      msg.payload
    )
    const obs = server.activeObservablesById.get(payload.observableId)
    if (obs) {
      payload.route = {
        name: obs.name,
      }
    }
  }
  createError(
    server,
    {
      worker,
      // TODO: not really worker context.. but ok clean up later
      context: msg.context || { headers: {} },
    },
    msg.code,
    msg.payload
  )
}
