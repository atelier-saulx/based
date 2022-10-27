import { ClientContext } from '../../types'
import { parentPort } from 'worker_threads'
import { parseQuery } from '@saulx/utils'

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
  const fn = require(path)
  let parsedPayload: any
  if (payload) {
    parsedPayload = parsePayload(id, context, payload)
  } else if (type === 4) {
    parsedPayload = parseQuery(context.query)
  }
  fn(parsedPayload, {})
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
}
