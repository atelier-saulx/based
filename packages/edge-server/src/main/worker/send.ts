import { BasedWorker } from '../../types'
import { IncomingMessage } from '../../worker/types'

export const sendToWorker = (worker: BasedWorker, msg: IncomingMessage) => {
  worker.worker.postMessage(msg)
}
