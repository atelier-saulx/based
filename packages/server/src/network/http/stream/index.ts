import uws from '@based/uws'
import { BasedServer } from '../../..'
import stream from './stream'

export const invalidReqNoCors = (res: uws.HttpResponse) => {
  res.aborted = true
  res
    .writeStatus('400 Invalid Request')
    .end(`{"code":400,"error":"Invalid Request"}`)
}

export type StreamOptions = {
  type: string
  size: number
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

  const type = req.getHeader('content-type')

  if (type === 'multipart/form-data') {
    // formStream(server, res)
    return
  }

  const size = Number(req.getHeader('content-length'))

  if (!type) {
    invalidReqNoCors(res)
    return
  }

  const opts: StreamOptions = {
    size,
    type,
  }

  if (!opts.size) {
    invalidReqNoCors(res)
    return
  }

  stream(res, size)
}
