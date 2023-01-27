import { BasedClient, encodeAuthState } from '..'
import { StreamFunctionContents } from './types'
import fetch from 'cross-fetch'
import getUrlFromOpts from '../getUrlFromOpts'

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
  const result = await fetch(url + '/' + name, {
    method: 'POST',
    cache: 'no-cache',
    headers: {
      'Content-Type': options.mimeType || 'text/plain',
      Authorization: encodeAuthState(client.authState),
    },
    body: options.contents,
  }).then((t) => t.text())

  try {
    return JSON.parse(result)
  } catch (e) {}

  return result
}
