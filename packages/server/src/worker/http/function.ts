import { ClientContext } from '../../types'
// import { parseQuery } from '@saulx/utils'

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

/*
else if (d.payload === undefined && d.context.method === 'get') {
      payload = parseQuery(d.context.query)
    } else if (d.payload) {
      // payload = parsePayload(d.context, d.payload)
    }

*/
