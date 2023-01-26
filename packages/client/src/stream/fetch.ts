import { BasedClient } from '..'
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
  const result = await fetch(url, {
    method: 'POST',
    cache: 'no-cache',
    headers: {
      'Content-Type': options.mimeType || 'text/plain',
      // 'File-Name': options.name || '',
      // opts in query param?
      // Authorization: client.auth.token,
    },
    body: options.contents,
  }).then((t) => t.text())

  try {
    return JSON.parse(result)
  } catch (e) {}

  return result
}
