import { BasedClient } from '..'
import { FileUploadPath, FileUploadContents, FileUploadStream } from './types'
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

const isFileUploadPath = (
  options: FileUploadContents | FileUploadStream | FileUploadPath
): options is FileUploadPath => {
  return 'path' in options && typeof options.path === 'string'
}

const isFileUploadStream = (
  options: FileUploadContents | FileUploadStream | FileUploadPath
): options is FileUploadStream => {
  return 'contents' in options && isStream(options.contents)
}

export default async (
  client: BasedClient,
  name: string,
  options: FileUploadContents | FileUploadStream | FileUploadPath
): Promise<any> => {
  if (isFileUploadPath(options)) {
    if (isBrowser) {
      throw new Error('File path not supported in the browser')
    }
    // not for browser! hope this is enough for most builders...
    return require('./stream').uploadFilePath(client, name, options)
  }

  if (isFileUploadStream(options)) {
    if (isBrowser) {
      throw new Error('Node streams not supported in the browser')
    }
    // not for browser! hope this is enough for most builders...
    return require('./stream').uploadFileStream(client, name, options)
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

  if (isBrowser && options.contents instanceof File) {
    return uploadFileBrowser(client, name, options)
  }

  throw new Error(
    `Invalid opts for file api ${name} ${JSON.stringify(options, null, 2)}`
  )
}
