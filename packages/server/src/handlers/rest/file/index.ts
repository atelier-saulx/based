import uws from '@based/uws'
import { BasedServer } from '../../..'
import { invalidReqNoCors } from '../invalidReq'
import stream from './stream'
import formStream from './formStream'
import { FileOptions } from './types'
import getExtenstion from './getExtenstion'
import mimeTypes from 'mime-types'

export default async (
  server: BasedServer,
  req: uws.HttpRequest,
  res: uws.HttpResponse,
  url: string
) => {
  res.writeHeader('Access-Control-Allow-Origin', '*')

  res.writeHeader(
    'Access-Control-Allow-Headers',
    'File-Extension, File-Name, File-Id, Function-Name, Content-Length, File-Is-Raw, Content-Type, Authorization'
  )

  const method = req.getMethod()

  if (method !== 'post') {
    console.info('options or get')
    res.end('')
    return
  }

  let type = req.getHeader('content-type')

  if (!type) {
    const ext = req.getHeader('file-extension')
    if (ext) {
      type = mimeTypes.lookup(ext)
      console.info(type)
    } else {
      invalidReqNoCors(res)
      return
    }
  }

  // const authorization = req.getHeader('authorization')
  // console.info('go auth', authorization)

  if (type === 'multipart/form-data') {
    formStream(server, res)
    return
  }

  const opts: FileOptions = {
    raw: !!req.getHeader('file-is-raw'),
    name: req.getHeader('file-name') || '',
    functionName: req.getHeader('function-name') || '',
    id: req.getHeader('file-id'),
    size: Number(req.getHeader('content-length')),
    type,
    extension: getExtenstion(type),
  }

  if (!opts.type || !opts.id || !opts.size) {
    invalidReqNoCors(res)
    return
  }

  stream(server, res, opts)
}
