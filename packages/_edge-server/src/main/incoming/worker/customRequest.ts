import { BasedWorker } from '../../../types'
import { IncomingType, Outgoing, OutgoingType } from '../../../worker/types'
import { BasedServer } from '../../server'
import { sendToWorker } from '../../worker'

export default (
  server: BasedServer,
  worker: BasedWorker,
  msg: Outgoing[OutgoingType.RequestFromMain]
) => {
  if (server.workerRequest) {
    const r = server.workerRequest(msg.requestType, msg.payload)
    if (r) {
      r.then((v) => {
        sendToWorker(worker, {
          type: IncomingType.RequestFromMain,
          id: msg.id,
          payload: v,
        })
      }).catch((err) => {
        sendToWorker(worker, {
          type: IncomingType.RequestFromMain,
          id: msg.id,
          err,
        })
      })
    } else {
      sendToWorker(worker, {
        type: IncomingType.RequestFromMain,
        id: msg.id,
        err: new Error('No main request handler for ' + msg.requestType),
      })
    }
  } else {
    console.warn('No workerRequest handler configured')
  }

  console.info('Incoming')
}
