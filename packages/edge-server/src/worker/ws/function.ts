import {
  decodePayload,
  valueToBuffer,
  encodeFunctionResponse,
} from '../../protocol'
import { FunctionType } from '../../types'
import { authorize } from '../authorize'
import { getFunction } from '../functions'
import { BasedErrorCode } from '../../error'
import { Incoming, IncomingType, OutgoingType } from '../types'
import send from '../send'

export default ({
  name,
  payload,
  isDeflate,
  path,
  context,
  id,
  reqId,
}: Incoming[IncomingType.WsFunction]) => {
  const fn = getFunction(name, FunctionType.function, path)

  console.info('WORKER!', name)

  let parsedPayload: any

  if (payload) {
    parsedPayload = decodePayload(payload, isDeflate)
  }

  authorize(context, name, parsedPayload)
    .then((ok) => {
      if (!ok) {
        send({
          type: OutgoingType.Listener,
          id,
          code: BasedErrorCode.AuthorizeRejectedError,
        })
        return false
      }
      fn(parsedPayload, context)
        .then((v: any) => {
          send({
            type: OutgoingType.Listener,
            id,
            payload: encodeFunctionResponse(reqId, valueToBuffer(v)),
          })
        })
        .catch((err: Error) => {
          send({
            type: OutgoingType.Listener,
            id,
            code: BasedErrorCode.FunctionError,
            err,
          })
        })
    })
    .catch((err) => {
      send({
        type: OutgoingType.Listener,
        id,
        code: BasedErrorCode.AuthorizeFunctionError,
        err,
      })
    })
}
