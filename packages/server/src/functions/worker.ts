import { parseQuery } from '@saulx/utils'
import { parentPort } from 'node:worker_threads'
import { decodePayload } from '../protocol'
import { ClientContext } from '../types'

console.info('start function workerthread')

const decoder = new TextDecoder('utf-8')

export const parsePayload = (context: ClientContext, data: Uint8Array): any => {
  const contentType = context.headers['content-type']

  if (contentType === 'application/json' || !contentType) {
    const str = decoder.decode(data)
    let parsedData: any
    try {
      parsedData = data.byteLength ? JSON.parse(str) : undefined
      return parsedData
    } catch (e) {
      // make this an event
      // has to buble up
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

// will pack the total message (for ws and http)

parentPort.on('message', (d) => {
  if (d.type === 1) {
    const fn = require(d.path)

    let payload: any

    if (d.context.method === 'ws') {
      if (d.payload) {
        payload = decodePayload(d.payload, d.isDeflate)
      }
      // console.log(x)
    } else if (d.payload === undefined && d.context.method === 'get') {
      payload = parseQuery(d.context.query)
    } else if (d.payload) {
      payload = parsePayload(d.context, d.payload)
    }

    // parse result
    // add deflate
    // measure cpu

    fn(payload, d.context)
      .then((v) => {
        parentPort.postMessage({
          reqId: d.reqId,
          payload: v,
        })
      })
      .catch((err) => {
        parentPort.postMessage({
          reqId: d.reqId,
          err,
        })
      })

    // fn!
  }
})
