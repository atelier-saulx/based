import { BasedClient, encodeAuthState } from '../index.js'
import { StreamFunctionContents, StreamHeaders } from './types.js'
import fetch from '@based/fetch'
import { serializeQuery } from '@saulx/utils'
import parseOpts from '@based/opts'

export default async (
  client: BasedClient,
  name: string,
  options: StreamFunctionContents
): Promise<any> => {
  if (!client.connected) {
    await client.once('connect')
  }

  const url = await parseOpts(client.opts, true)

  const headers: StreamHeaders = {
    'Content-Type': options.mimeType || 'text/plain',
    Authorization: encodeAuthState(client.authState),
  }

  if (options.fileName) {
    headers['Content-Name'] = options.fileName
  }

  let q = ''
  if (options.payload) {
    q = '?' + serializeQuery(options.payload)
  }

  const result = await fetch(url + '/' + name + q, {
    method: 'POST',
    cache: 'no-cache',
    headers,
    // @ts-ignore
    body: options.contents,
  }).then((t) => t.text())

  try {
    return JSON.parse(result)
  } catch (e) {}

  return result
}
