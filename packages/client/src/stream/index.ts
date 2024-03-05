import { BasedClient } from '../index.js'
import {
  StreamFunctionOpts,
  isStreamFunctionPath,
  isStreamFunctionStream,
} from './types.js'
import { Readable } from 'node:stream'
import { uploadFilePath, uploadFileStream } from './nodeStream.js'

export const isStreaming = { streaming: false }

async function* generateChunks(bytes: ArrayBuffer) {
  // 100kb (bit arbitrary)
  const readBytes = 100000
  let index = 0
  while (index * readBytes < bytes.byteLength) {
    const buf = bytes.slice(
      index * readBytes,
      Math.min(bytes.byteLength, (index + 1) * readBytes)
    )
    index++
    yield Buffer.from(buf)
  }
}

const createReadableStreamFromContents = (bytes: ArrayBuffer): Readable => {
  return Readable.from(generateChunks(bytes))
}

export default async (
  client: BasedClient,
  name: string,
  options: StreamFunctionOpts,
  progressListener?: (progress: number, bytes: number) => void
): Promise<any> => {
  if (isStreamFunctionPath(options)) {
    return uploadFilePath(client, name, options, progressListener)
  }

  if (isStreamFunctionStream(options)) {
    return uploadFileStream(client, name, options, progressListener)
  }

  if (options.contents instanceof global.Buffer) {
    options.contents = options.contents.buffer
  }

  if (typeof options.contents === 'string') {
    options.contents = new TextEncoder().encode(options.contents)
  }

  if (options.contents instanceof ArrayBuffer) {
    return uploadFileStream(
      client,
      name,
      {
        ...options,
        size: options.contents.byteLength,
        contents: createReadableStreamFromContents(options.contents),
      },
      progressListener
    )
  }

  throw new Error(
    `Invalid opts for file api ${name} ${JSON.stringify(options, null, 2)}`
  )
}
