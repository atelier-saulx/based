import { ClientContext, FunctionType, HttpMethod } from '../../types'
import { parseQuery } from '@saulx/utils'
import { authorize } from '../authorize'
import { getFunction } from '../functions'
import { BasedErrorCode } from '../../error'
import { Incoming, IncomingType, OutgoingType } from '../types'
import send from '../send'

const decoder = new TextDecoder('utf-8')

export const parsePayload = (
  id: number,
  context: ClientContext,
  data: Uint8Array
): any => {
  const contentType = context.headers['content-type']
  if (contentType === 'application/json' || !contentType) {
    const str = decoder.decode(data)
    let parsedData: any
    try {
      parsedData = data.byteLength ? JSON.parse(str) : undefined
      return parsedData
    } catch (err) {
      send({
        type: OutgoingType.Listener,
        id,
        err,
        code: BasedErrorCode.InvalidPayload,
      })
    }
  } else if (
    contentType.startsWith('text') ||
    contentType === 'application/xml'
  ) {
    return decoder.decode(data)
  } else {
    return data
  }
}

export default (msg: Incoming[IncomingType.HttpFunction]) => {
  const { name, payload, context, id, path } = msg

  const fn = getFunction(name, FunctionType.function, path)
  let parsedPayload: any
  if (payload) {
    parsedPayload = parsePayload(id, context, payload)
  } else if (msg.method === HttpMethod.Get && 'query' in context) {
    // TODO: for these kind of parsing things much better to use simdjson and a buffer...
    try {
      parsedPayload = parseQuery(decodeURIComponent(context.query))
    } catch (err) {}
  }
  authorize(context, name, parsedPayload)
    .then((ok) => {
      if (!ok) {
        send({
          type: OutgoingType.Listener,
          id,
          code: BasedErrorCode.AuthorizeRejectedError,
        })
        return
      }
      fn(parsedPayload, context)
        .then((v: any) => {
          send({
            type: OutgoingType.Listener,
            id,
            payload: v,
          })
        })
        .catch((err: Error) => {
          send({
            type: OutgoingType.Listener,
            id,
            err,
            code: BasedErrorCode.FunctionError,
          })
        })
    })
    .catch((err) => {
      send({
        type: OutgoingType.Listener,
        id,
        err,
        code: BasedErrorCode.AuthorizeFunctionError,
      })
    })
}
