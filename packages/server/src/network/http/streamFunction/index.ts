import uws from '@based/uws'
// import { HttpClient } from '../../../types'
// import end from '../end'
// import { DataStream } from './DataStre
import stream from './stream'
import { BasedServer } from '../../../server'
import { sendError } from '../sendError'
import { BasedFunctionRoute } from '../../../types'

export type StreamOptions = {
  type: string
  size: number
}

export default async (server: BasedServer, route: BasedFunctionRoute) => {
  // route config
  // const method = req.getMethod()
  // if (method !== 'post') {
  //   console.info('options or get')
  //   res.end('')
  //   return
  // }
  // const type = req.getHeader('content-type')
  // if (type === 'multipart/form-data') {
  //   // formStream(server, res)
  //   return
  // }
  // const size = Number(req.getHeader('content-length'))
  // if (!type) {
  //   sendError(res)
  //   return
  // }
  // const opts: StreamOptions = {
  //   size,
  //   type,
  // }
  // if (!opts.size) {
  //   sendError(res)
  //   return
  // }
  // stream(res, size)
}
