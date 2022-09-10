import type { ServerOptions } from '../types'
import type { BasedServer } from '../server'
import uws from '@based/uws'
import { upgradeAuthorize, upgrade } from './upgrade'
import { message } from './message'
import { unsubscribeIgnoreClient } from '../observable'
import { httpHandler } from './http'

// const genLargeMemBlock = (): string => {
//   let str = ''
//   for (let i = 0; i < 10000; i++) {
//     str += Math.random() * 99999 + ' xxxx'
//   }
//   return str
// }

export default (server: BasedServer, { key, cert, port }: ServerOptions) => {
  const app =
    key && cert
      ? uws.SSLApp({
          key_file_name: key,
          cert_file_name: cert,
          ssl_prefer_low_memory_usage: true,
        })
      : uws.App()

  if (port) {
    server.port = port
  }

  /*
  open:ws=>ws.subscribe('all')
  app.publish('all',message)
  */

  // WeakMap for clients

  app
    .ws('/*', {
      maxPayloadLength: 1024 * 1024 * 5,
      idleTimeout: 100,
      maxBackpressure: 1024,
      // compression: uws.SHARED_COMPRESSOR,
      upgrade: server.auth?.config?.authorizeConnection
        ? (res, req, ctx) => {
            upgradeAuthorize(
              server.auth.config.authorizeConnection,
              res,
              req,
              ctx
            )
          }
        : upgrade,
      message: (ws, data, isBinary) => {
        message(server, ws.c, data, isBinary)
      },
      open: (ws) => {
        if (ws) {
          // ws.bla = genLargeMemBlock()
          const client = { ws }
          ws.c = client
        }
        //
        // ws.token = 'x' token - only on upgrade does make it super easy (for auth)
        // does add overhead when reconn
        // console.info(ws)
        // broadcast will only do diffs except when its a new sub
        // send is used to send a current value
        // open(this, ws)
      },
      close: (ws) => {
        // console.info('close', 'remove from subs')
        ws.obs.forEach((id) => {
          unsubscribeIgnoreClient(server, id, ws.c)
        })
        ws.c.ws = null
        ws.c = null
      },
      drain: () => {
        console.info('drain')
        // lets handle drain efficiently (or more efficiently at least)

        // call client.drain can be much more efficient
        // if (ws.client && ws.client.backpressureQueue) {
        //   ws.client.drain()
        // }
      },
    })
    // REST
    .get('/*', (res, req) => httpHandler(server, req, res))
    .post('/*', (res, req) => httpHandler(server, req, res))
    .options('/*', (res, req) => httpHandler(server, req, res))

  server.uwsApp = app
}
