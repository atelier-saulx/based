import type { ServerOptions } from '../types'
import type { BasedServer } from '../server'
import uws from '@based/uws'
import { upgradeAuthorize, upgrade } from './upgrade'
import { message } from './message'
import { unsubscribeIgnoreClient } from '../observable'
import { httpHandler } from './http'

// ----------------- mem test code -------------------
// let cl = 0
// const genLargeMemBlock = (): string => {
//   ++cl
//   let str = ''
//   for (let i = 0; i < 100000; i++) {
//     str += Math.random() * 99999 + ' xxxx'
//   }
//   return str
// }
// let cnt = 0
// setInterval(() => {
//   ++cnt
//   console.info('Amount of clients', cl, 'after', cnt, 'seconds')
// }, 1e3)
// -----------------------------------------------------

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
      },
      close: (ws) => {
        // cl--
        ws.obs.forEach((id) => {
          unsubscribeIgnoreClient(server, id, ws.c)
        })
        // Looks really ugly but same impact on memory and GC as using the ws directly
        // and better for dc's when functions etc are in progress
        ws.c.ws = null
        ws.c = null
      },
      drain: () => {
        // console.info('drain')
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
