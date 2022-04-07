import { Based, FileUploadPath, FileUploadStream } from '..'
import { FileUploadOptions, FileUploadSrc } from '@based/types'
import uploadFileBrowser from './uploadFileBrowser'
import getUrl from './getUrl'
import fetch from './fetch'
import { isStream, uploadFilePath, uploadFileStream } from './stream'

const isBrowser = typeof window !== 'undefined'

const isFileUploadSrc = (
  options: FileUploadOptions | FileUploadSrc | FileUploadStream | FileUploadPath
): options is FileUploadSrc => {
  return 'src' in options && typeof options.src === 'string'
}

const isFileUploadPath = (
  options: FileUploadOptions | FileUploadSrc | FileUploadStream | FileUploadPath
): options is FileUploadPath => {
  return 'path' in options && typeof options.path === 'string'
}

const isFileUploadStream = (
  options: FileUploadOptions | FileUploadSrc | FileUploadStream | FileUploadPath
): options is FileUploadStream => {
  return 'contents' in options && isStream(options.contents)
}

export default async (
  client: Based,
  options: FileUploadOptions | FileUploadSrc | FileUploadStream | FileUploadPath
): Promise<{ id: string }> => {
  if (isFileUploadSrc(options)) {
    const payload: any = options.id ? { $id: options.id } : { type: 'file' }
    if (options.src) {
      payload.src = options.src
      payload.origin = options.src
      if (options.size) {
        payload.size = options.size
      }
      if (options.name) {
        payload.name = options.name
      }
      if (options.parents) {
        payload.parents = options.parents
      }
      return await client.set(payload)
    }
    return
  }

  let id = options.id
  if (!id) {
    const payload: any = { type: 'file', progress: 0 }
    if (options.name) {
      payload.name = options.name
    } else if (
      global.File &&
      'contents' in options &&
      options.contents instanceof global.File
    ) {
      payload.name = options.contents.name
    }
    if (options.parents) {
      payload.parents = options.parents
    }
    const r = await client.set(payload)
    id = r.id
  }

  options.id = id

  const url = (await getUrl(client, options)).replace(/^ws/, 'http')

  if (isFileUploadPath(options)) {
    uploadFilePath(client, url, options)
    return { id }
  }

  if (isFileUploadStream(options)) {
    uploadFileStream(client, url, options)
    return { id }
  }

  if (options.contents instanceof ArrayBuffer) {
    options.contents = isBrowser
      ? new global.Blob([options.contents], {
          type: options.mimeType || 'text/plain',
        })
      : global.Buffer.from(options.contents)
    return fetch(client, url + '/file', options)
  }

  if (isBrowser && options.contents instanceof global.Blob) {
    if (!options.mimeType) {
      options.mimeType = options.contents.type
    }
    return fetch(client, url + '/file', options)
  }

  if (
    typeof options.contents === 'string' ||
    (!isBrowser && options.contents instanceof global.Buffer)
  ) {
    return fetch(client, url + '/file', options)
  }

  // this is abit more strange
  if (isBrowser && options.contents instanceof File) {
    uploadFileBrowser(
      client,
      options.contents,
      url,
      options.id,
      options.raw || false,
      options.name,
      options.functionName
    )
    return { id }
  }

  // remove the file you created here...
  if (!options.id) {
    await client.delete({ $id: id })
  }

  throw new Error(
    `Invalid contents for file api ${JSON.stringify(options, null, 2)}`
  )
}
