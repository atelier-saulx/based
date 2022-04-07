import { FileUploadStream, FileUploadPath } from '@based/types'
import type { Readable } from 'stream'
import { Based } from '../..'

export const isStream = (contents: any): contents is Readable => {
  return typeof contents === 'object' && contents.read
}

export const uploadFileStream = (
  client: Based,
  url: string,
  options: FileUploadStream
) => {
  console.info('streams not supported in the browser')
}

export const uploadFilePath = (
  client: Based,
  url: string,
  options: FileUploadPath
) => {
  // can support urls
  console.info('paths not yet implemented in browser')
}
