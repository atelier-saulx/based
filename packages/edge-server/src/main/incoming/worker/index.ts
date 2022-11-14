import { BasedServer } from '../../server'
import { BasedWorker } from '../../../types'
import { subscribe, unsubscribe } from './observable'
import { OutgoingMessage, OutgoingType } from '../../../worker/types'
import listener from './listener'
import error from './error'
import installFunction from './installFunction'

export const incomingWorkerMessage = (
  server: BasedServer,
  worker: BasedWorker,
  msg: OutgoingMessage
) => {
  if (msg.type === OutgoingType.Listener) {
    listener(server, msg)
    return
  }

  if (msg.type === OutgoingType.Error) {
    error(server, worker, msg)
    return
  }

  if (msg.type === OutgoingType.InstallFn) {
    installFunction(server, worker, msg)
    return
  }

  if (msg.type === OutgoingType.Log) {
    server.emit(
      'log',
      {
        worker,
        context: msg.context || { headers: {} },
      },
      msg.log
    )
    return
  }

  if (msg.type === OutgoingType.Subscribe) {
    subscribe(
      msg.name,
      msg.payload,
      msg.id,
      {
        worker,
        context: msg.context,
      },
      server
    )
    return
  }

  if (msg.type === OutgoingType.Unsubscribe) {
    unsubscribe(
      {
        worker,
        context: msg.context,
      },
      msg.id,
      server
    )
  }
}
