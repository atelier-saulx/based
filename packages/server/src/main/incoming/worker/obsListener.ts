import { BasedError, BasedErrorCode } from '../../../error'
import { Outgoing, OutgoingType } from '../../../worker/types'
import { BasedServer } from '../../server'

export default (
  server: BasedServer,
  msg: Outgoing[OutgoingType.ObservableUpdate]
) => {
  const listener = server.functions.workerObsListeners.get(msg.id)
  if (listener) {
    if ('err' in msg) {
      // @ts-ignore
      const err: BasedError<BasedErrorCode.ObservableFunctionError> = msg.err
      err.code = BasedErrorCode.ObservableFunctionError
      listener(err)
    } else {
      listener(null, msg.payload)
    }
  }
}
