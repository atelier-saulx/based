import { Based } from '..'
import { FileUploadOptions } from '@based/types'
import fetch from 'cross-fetch'

export default (
  client: Based,
  url: string,
  options: FileUploadOptions
): { id: string } => {
  fetch(url, {
    method: 'POST',
    cache: 'no-cache',
    headers: {
      'Content-Type': options.mimeType || 'text/plain',
      'File-Id': options.id,
      'File-Is-Raw': options.raw ? '1' : '0',
      'File-Name': options.name || '',
      'Function-Name': options.functionName || '',
      Authorization: client.getToken(),
    },
    body: options.contents,
  })
    .then((v) => {})
    .catch((err) => {
      console.error('Error while uploading file', err)
    })
  return { id: options.id }
}
