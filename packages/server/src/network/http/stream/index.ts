import uws from '@based/uws'
import { BasedServer } from '../../..'
import stream from './stream'
// import formStream from './multipartFormStream'
import getExtenstion from './getExtenstion'
import mimeTypes from 'mime-types'

export const invalidReqNoCors = (res: uws.HttpResponse) => {
  res.aborted = true
  res
    .writeStatus('400 Invalid Request')
    .end(`{"code":400,"error":"Invalid Request"}`)
}

export default async (
  server: BasedServer,
  name: string,
  req: uws.HttpRequest,
  res: uws.HttpResponse
) => {
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

  // from header only...
  if (type === 'multipart/form-data') {
    // formStream(server, res)
    return
  }

  //

  const size = Number(req.getHeader('content-length'))

  // custom header parsing

  // stream
  const opts = {
    raw: !!req.getHeader('file-is-raw'),
    name: req.getHeader('file-name') || '',
    id: req.getHeader('file-id'),
    size,
    type,
    extension: getExtenstion(type),
  }

  if (!opts.size) {
    invalidReqNoCors(res)
    return
  }

  stream(res, size)
}
