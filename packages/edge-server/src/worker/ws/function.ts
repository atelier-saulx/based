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
  let fn = require(path)
  if (fn.default) {
    fn = fn.default
  }

  let parsedPayload: any

  if (payload) {
    parsedPayload = decodePayload(payload, isDeflate)
  }

  authorize(context, name, parsedPayload)
    .then((ok) => {
      if (!ok) {
        parentPort.postMessage({
          id,
          err: new Error('AUTH WRONG'),
        })
        return false
      }

      fn(parsedPayload, context)
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
      parentPort.postMessage({
        id,
        err,
      })
    })
}
