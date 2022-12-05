import { Readable } from 'stream'
import { BasedServer } from '../../..'
import { FileOptions } from './types'
import { Client } from '../../../Client'

export default async (
  server: BasedServer,
  stream: Readable,
  opts: FileOptions,
  user: Client
): Promise<void> => {
  const storeFile = server.config.storeFile

  if (!storeFile) {
    throw new Error('No file upload handler available!')
  }

  const result = await storeFile({
    based: server.based,
    stream,
    id: opts.id,
    mimeType: opts.type,
    extension: opts.extension,
    size: opts.size,
    user,
  })

  const setObj: any = {
    $id: opts.id,
    src: result.src,
    origin: result.origin,
    status: result.status,
    version: result.version,
    mimeType: result.mimeType || opts.type,
  }

  if (result.thumb) {
    setObj.thumb = result.thumb
  }

  if (result.statusText) {
    setObj.statusText = result.statusText
  }

  // add version
  server.based.set(setObj)
}
