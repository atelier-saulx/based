import { OutgoingMessage } from './types'
import { parentPort } from 'worker_threads'

export default (msg: OutgoingMessage) => {
  parentPort.postMessage(msg)
}
