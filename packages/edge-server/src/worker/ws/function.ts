import {
  decodePayload,
  valueToBuffer,
  encodeFunctionResponse,
} from '../../protocol'
import { parentPort } from 'node:worker_threads'
import { ClientContext, FunctionType } from '../../types'
import { authorize } from '../authorize'
import { getFunction } from '../functions'

export default (
  name: string,
  path: string,
  id: number,
  reqId: number,
  context: ClientContext,
  isDeflate: boolean,
  payload?: Uint8Array
) => {
  const fn = getFunction(name, FunctionType.function, path)

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
