import {
  decodePayload,
  valueToBuffer,
  encodeFunctionResponse,
} from '../../protocol'
import { parentPort, workerData } from 'node:worker_threads'
import { ClientContext } from '../../types'
import { authorize } from '../authorize'

const { functionApiWrapperPath } = workerData
const fnWrapper = require(functionApiWrapperPath).runFunction

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
      if (!ok) {
        parentPort.postMessage({
          id,
          err: new Error('AITH WRONG'),
        })
        return false
      }

      fnWrapper(name, fn, parsedPayload, context)
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
