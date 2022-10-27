import {
  decodePayload,
  valueToBuffer,
  encodeFunctionResponse,
} from '../../protocol'
import { parentPort } from 'node:worker_threads'
import { ClientContext } from '../../types'
import { authorize } from '../authorize'

export default (
  name: string,
  path: string,
  id: number,
  reqId: number,
  context: ClientContext,
  isDeflate: boolean,
  payload?: Uint8Array
) => {
  const fn = require(path)

  let parsedPayload: any

  if (payload) {
    parsedPayload = decodePayload(payload, isDeflate)
  }

  authorize(context, name, payload)
    .then((ok) => {
      if (ok) {
        return false
      }

      fn(parsedPayload, {})
        .then((v) => {
          parentPort.postMessage({
            id,
            payload: encodeFunctionResponse(reqId, valueToBuffer(v)),
          })
        })
        .catch((err) => {
          parentPort.postMessage({
            id,
            err,
          })
        })
    })
    .catch((err) => {
      console.error('WRONGDX', err)
    })
}
