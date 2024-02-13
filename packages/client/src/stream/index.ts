import { BasedClient } from '../index.js'
import {
  StreamFunctionOpts,
  isStreamFunctionPath,
  isStreamFunctionStream,
} from './types.js'
import { uploadFilePath, uploadFileStream } from './nodeStream.js'

export const isStreaming = { streaming: false }

export default async (
  client: BasedClient,
  name: string,
  options: StreamFunctionOpts,
  _progressListener?: (progress: number) => void
): Promise<any> => {
  if (isStreamFunctionPath(options)) {
    return uploadFilePath(client, name, options)
  }

  if (isStreamFunctionStream(options)) {
    return uploadFileStream(client, name, options)
  }

  if (options.contents instanceof ArrayBuffer) {
    options.contents = global.Buffer.from(options.contents)
    // return fetch(client, name, options)
  }

  if (
    typeof options.contents === 'string' ||
    options.contents instanceof global.Buffer
  ) {
    // return fetch(client, name, options)
  }

  throw new Error(
    `Invalid opts for file api ${name} ${JSON.stringify(options, null, 2)}`
  )
}
