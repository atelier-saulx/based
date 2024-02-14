import { BasedClient } from '../index.js'
import {
  isFileContents,
  StreamFunctionOpts,
  isStreamFunctionPath,
  isStreamFunctionStream,
} from './types.js'

export const isStreaming = { streaming: false }

// will get browser stream as well

export default async (
  client: BasedClient,
  name: string,
  options: StreamFunctionOpts,
  progressListener?: (progress: number) => void
): Promise<any> => {
  if (isStreamFunctionPath(options)) {
    return
  }

  if (isStreamFunctionStream(options)) {
    return
  }

  if (options.contents instanceof ArrayBuffer) {
    options.contents = new global.Blob([options.contents], {
      type: options.mimeType || 'text/plain',
    })
    // want to stream this XHR browser / stream + http nodejs
    // return fetch(client, name, options)
  }

  if (isFileContents(options)) {
    // return uploadFileBrowser(client, name, options, progressListener)
  }

  if (options.contents instanceof global.Blob) {
    if (!options.mimeType) {
      options.mimeType = options.contents.type
    }
  }

  if (typeof options.contents === 'string') {
  }

  throw new Error(
    `Invalid opts for file api ${name} ${JSON.stringify(options, null, 2)}`
  )
}
