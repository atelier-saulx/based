import { BasedClient, encodeAuthState } from '..'
import { StreamFunctionContents, StreamHeaders } from './types'
import fetch from 'cross-fetch'
import getUrlFromOpts from '../getUrlFromOpts'
import { parsePayload } from './parsePayload'

export default async (
  client: BasedClient,
  name: string,
  options: StreamFunctionContents
): Promise<any> => {
  console.info(client)
  let url = await getUrlFromOpts(client.opts)
  if (typeof url === 'function') {
    url = await url()
  }

  const headers: StreamHeaders = {
    'Content-Type': options.mimeType || 'text/plain',
    Authorization: encodeAuthState(client.authState),
  }

  if (options.payload) {
    headers.Payload = parsePayload(options.payload)
  }

  const result = await fetch(url + '/' + name, {
    method: 'POST',
    cache: 'no-cache',
    headers,
    body: options.contents,
  }).then((t) => t.text())

  try {
    return JSON.parse(result)
  } catch (e) {}

  return result
}
