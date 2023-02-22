import { BasedClient } from '..'
import {
  isFileContents,
  StreamFunctionOpts,
  StreamFunctionPath,
  StreamFunctionStream,
} from './types'
import uploadFileBrowser from './uploadFileBrowser'
import fetch from './fetch'

const isBrowser = typeof window !== 'undefined'

const isStream = (stream: any): boolean => {
  return (
    stream !== null &&
    typeof stream === 'object' &&
    typeof stream.pipe === 'function' &&
    stream.readable !== false &&
    typeof stream._read === 'function' &&
    typeof stream._readableState === 'object'
  )
}

const isStreamFunctionPath = (
  options: StreamFunctionOpts
): options is StreamFunctionPath => {
  return 'path' in options && typeof options.path === 'string'
}

const isStreamFunctionStream = (
  options: StreamFunctionOpts
): options is StreamFunctionStream => {
  return 'contents' in options && isStream(options.contents)
}

export default async (
  client: BasedClient,
  name: string,
  options: StreamFunctionOpts,
  progressListener?: (progress: number) => void
): Promise<any> => {
  if (isStreamFunctionPath(options)) {
    if (isBrowser) {
      throw new Error('File path not supported in the browser')
    }
    // not for browser! hope this is enough for most builders...
    return require('./nodeStream').uploadFilePath(client, name, options)
  }

  if (isStreamFunctionStream(options)) {
    if (isBrowser) {
      throw new Error('Node streams not supported in the browser')
    }
    // not for browser! hope this is enough for most builders...
    return require('./nodeStream').uploadFileStream(client, name, options)
  }

  if (options.contents instanceof ArrayBuffer) {
    options.contents = isBrowser
      ? new global.Blob([options.contents], {
          type: options.mimeType || 'text/plain',
        })
      : global.Buffer.from(options.contents)

    // want to stream this XHR browser / stream + http nodejs
    return fetch(client, name, options)
  }

  if (isBrowser && isFileContents(options)) {
    return uploadFileBrowser(client, name, options, progressListener)
  }

  if (isBrowser && options.contents instanceof global.Blob) {
    if (!options.mimeType) {
      options.mimeType = options.contents.type
    }

    // want to stream this XHR browser / stream + http nodejs
    return fetch(client, name, options)
  }

  if (
    typeof options.contents === 'string' ||
    (!isBrowser && options.contents instanceof global.Buffer)
  ) {
    // want to stream this XHR browser / stream + http nodejs
    return fetch(client, name, options)
  }

  throw new Error(
    `Invalid opts for file api ${name} ${JSON.stringify(options, null, 2)}`
  )
}
