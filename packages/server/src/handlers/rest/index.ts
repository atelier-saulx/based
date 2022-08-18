import uws from '@based/uws'
import { BasedServer } from '../..'
import readBody from './readBody'
import { Client } from '../../Client'
import getReqMessage from './getReqMessage'
import { Message, TrackMessage } from '@based/client'
import handleRequests from '../handleRequests'
import qs from 'querystring'
import file from './file'
import invalidReq from './invalidReq'
import playground from './playground'

const execMessages = (
  server: BasedServer,
  res: uws.HttpResponse,
  message: Message | TrackMessage,
  token?: string,
  format: 0 | 1 = 0
) => {
  const client = new Client(server, undefined, res, format)
  const messages = [message]
  if (token) {
    client.setToken(token)
  }
  res.client = client
  handleRequests(server, client, messages)
}

export default async (
  server: BasedServer,
  req: uws.HttpRequest,
  res: uws.HttpResponse
) => {
  const url = req.getUrl()

  res.onAborted(() => {
    res.aborted = true
    if (res.client) {
      res.client.destroy()
      res.client = null
    }
  })

  if (!url) {
    invalidReq(res)
    return
  }

  const fn = url.split('/')
  const handler = fn[1]

  if (
    !(
      handler &&
      (handler === 'call' ||
        handler === 'file' ||
        handler === 'playground' ||
        handler === 'get' ||
        handler === 'delete' ||
        handler === 'copy' ||
        handler === 'set' ||
        handler === 'configure' ||
        handler === 'update-schema' ||
        handler === 'updateSchema' ||
        handler === 'configuration' ||
        handler === 'track' ||
        handler === 'schema' ||
        handler === 'digest')
    )
  ) {
    invalidReq(res)
    return
  }

  if (handler === 'file') {
    return file(server, req, res, url)
  } else if (handler === 'playground') {
    const format: 0 | 1 = 0
    const client = new Client(server, undefined, res, format)
    return playground(server, client, req, res, url)
  }

  let token = req.getHeader('authorization')
  const acceptEncoding = req.getHeader('accept-encoding')
  const method = req.getMethod()
  const contentType = req.getHeader('content-type') || 'application/json'
  // have to make this cleaner...
  if (acceptEncoding) {
    res.acceptEncoding = acceptEncoding
  }

  let format: 0 | 1 = 0
  const last = fn[fn.length - 1]
  if (last.endsWith('.csv')) {
    format = 1
    fn[fn.length - 1] = last.slice(0, -4)
  }

  res.ua = req.getHeader('user-agent')

  // TODO also: how do we do want to do this? (why dont we just give access to the request object or the headers?)
  res.acceptLanguage = req.getHeader('accept-language')
  res.host = req.getHeader('host')

  if (method === 'post') {
    readBody(res, handler === 'digest' ? 'text/plain' : contentType, (d) => {
      const message = getReqMessage(fn, d)
      if (!message) {
        invalidReq(res)
      } else {
        execMessages(server, res, message, token, format)
      }
    })
    return
  }

  if (method === 'get') {
    const query = req.getQuery()
    let payload
    if (query) {
      const x = qs.parse(query)
      const p = x.q || x.payload
      if (x.token && !token) {
        if (typeof x.token === 'string') {
          token = x.token
        }
      }
      if (p) {
        try {
          // @ts-ignore
          payload = JSON.parse(p)
        } catch (err) {}
      }
    }
    const message = getReqMessage(fn, payload)
    if (message) {
      execMessages(server, res, message, token, format)
      return
    }
  }

  invalidReq(res)
}
