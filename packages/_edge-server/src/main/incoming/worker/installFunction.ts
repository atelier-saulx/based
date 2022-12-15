import { BasedWorker } from '../../../types'
import { IncomingType, Outgoing, OutgoingType } from '../../../worker/types'
import { BasedServer } from '../../server'
import { sendToWorker } from '../../worker'

export default (
  server: BasedServer,
  worker: BasedWorker,
  msg: Outgoing[OutgoingType.InstallFn]
) => {
  server.functions
    .install(msg.name)
    .then((spec) => {
      if (spec) {
        sendToWorker(worker, {
          type: IncomingType.AddFunction,
          name: spec.name,
          path: spec.functionPath,
        })
      } else {
        sendToWorker(worker, {
          type: IncomingType.InstallFunctionError,
          name: msg.name,
        })
      }
    })
    .catch(() => {
      sendToWorker(worker, {
        type: IncomingType.InstallFunctionError,
        name: msg.name,
      })
    })
}
