import { BasedError } from '../../../error'
import { Outgoing, OutgoingType } from '../../../worker/types'
import { BasedServer } from '../../server'

export default (server: BasedServer, msg: Outgoing[OutgoingType.Listener]) => {
  const listener = server.functions.workerResponseListeners.get(msg.id)
  if (listener) {
    if ('code' in msg) {
      const err: BasedError = !msg.err
        ? <BasedError>new Error()
        : <BasedError>msg.err
      err.code = msg.code
      listener(err)
    } else {
      listener(null, msg.payload)
    }
  }
}
