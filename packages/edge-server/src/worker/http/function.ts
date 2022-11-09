import { ClientContext, FunctionType } from '../../types'
import { parentPort } from 'worker_threads'
import { parseQuery } from '@saulx/utils'
import { authorize } from '../authorize'
import { getFunction } from '../functions'

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
      parentPort.postMessage({
        id,
        err,
      })
      // sendHttpError(server, client, BasedErrorCode.InvalidPayload, route)
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

export default (
  name: string,
  type: number,
  path: string,
  id: number,
  context: ClientContext,
  payload?: Uint8Array
) => {
  const fn = getFunction(name, FunctionType.function, path)
  let parsedPayload: any
  if (payload) {
    parsedPayload = parsePayload(id, context, payload)
  } else if (type === 4) {
    try {
      parsedPayload = parseQuery(decodeURIComponent(context.query))
    } catch (err) {}
  }
  authorize(context, name, parsedPayload)
    .then((ok) => {
      if (!ok) {
        console.error('auth wrong')
        // err will become based error
        parentPort.postMessage({
          id,
          err: new Error('AUTH WRONG'),
        })
        return
      }
      fn(parsedPayload, context)
        .then((v) => {
          parentPort.postMessage({
            id,
            payload: v,
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
