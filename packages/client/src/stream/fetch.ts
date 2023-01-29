import { BasedClient, encodeAuthState } from '..'
import { StreamFunctionContents, StreamHeaders } from './types'
import fetch from 'cross-fetch'
import getUrlFromOpts from '../getUrlFromOpts'
import { serializeQuery } from '@saulx/utils'

export default async (
  client: BasedClient,
  name: string,
  options: StreamFunctionContents
): Promise<any> => {
  if (!client.connected) {
    await client.once('connect')
  }

  // key is something special
  let url = await getUrlFromOpts(client.opts)
  if (typeof url === 'function') {
    url = await url()
  }

  const headers: StreamHeaders = {
    'Content-Type': options.mimeType || 'text/plain',
    Authorization: encodeAuthState(client.authState),
  }

  let q = ''
  if (options.payload) {
    q = '?' + serializeQuery(options.payload)
  }

  const result = await fetch(url.replace(/^ws/, 'http') + '/' + name + q, {
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
