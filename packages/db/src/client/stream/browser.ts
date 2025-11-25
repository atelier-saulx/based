import { BasedClient } from '../index.js'
import { isFileContents, StreamFunctionContents } from './types.js'
import { uploadFile } from './browserStream.js'

export const isStreaming = { streaming: false }

// will get browser stream as well

export default async (
  client: BasedClient,
  name: string,
  options: StreamFunctionContents,
  progressListener?: (progress: number) => void
): Promise<any> => {
  if (
    options.contents instanceof ArrayBuffer ||
    typeof options.contents === 'string'
  ) {
    options.contents = new global.Blob([options.contents], {
      type: options.mimeType || 'text/plain',
    })
  }

  if (options.contents instanceof global.Blob) {
    if (!options.mimeType) {
      options.mimeType = options.contents.type
    }
    options.contents = new File(
      [options.contents],
      options.fileName || 'blob',
      { type: options.contents.type }
    )
  }

  if (isFileContents(options)) {
    if (!options.size) {
      options.size = options.contents.size
    }
    return uploadFile(client, name, options, progressListener)
  }

  throw new Error(
    `Invalid opts for file api ${name} ${JSON.stringify(options, null, 2)}`
  )
}
