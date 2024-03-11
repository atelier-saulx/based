import { BasedClient } from '../index.js'
import {
  isFileContents,
  StreamFunctionOpts,
  isStreamFunctionPath,
  isStreamFunctionStream,
} from './types.js'
import { uploadFile } from './browserStream.js'

export const isStreaming = { streaming: false }

// will get browser stream as well

export default async (
  client: BasedClient,
  name: string,
  options: StreamFunctionOpts,
  progressListener?: (progress: number) => void
): Promise<any> => {
  if (isStreamFunctionPath(options) || isStreamFunctionStream(options)) {
    return
  }

  if (
    options.contents instanceof ArrayBuffer ||
    typeof options.contents === 'string'
  ) {
    options.contents = new global.Blob([options.contents], {
      type: options.mimeType || 'text/plain',
    })
  }

  if (isFileContents(options)) {
    if (!options.size) {
      options.size = options.contents.size
    }
    return uploadFile(client, name, options, progressListener)
  }

  if (options.contents instanceof global.Blob) {
    if (!options.mimeType) {
      options.mimeType = options.contents.type
    }

    options.contents = new File([options.contents], options.fileName || 'blob')

    // @ts-ignore
    return uploadFile(client, name, options, progressListener)
  }

  throw new Error(
    `Invalid opts for file api ${name} ${JSON.stringify(options, null, 2)}`
  )
}
