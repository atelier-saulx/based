import type { BasedServer, ServerOptions } from '../server'
import uws from '@based/uws'
import { upgradeAuthorize, upgrade } from './upgrade'
import { message } from './ws'
import { unsubscribeWsIgnoreClient } from '../observable'
import { httpHandler } from './http'
import { WebSocketSession, Context } from '../context'

export default (
  server: BasedServer,
  { key, cert, port, ws: wsListeners }: ServerOptions
) => {
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

  if (!wsListeners) {
    wsListeners = {
      open: () => undefined,
      close: () => undefined,
    }
  }

  app
    .ws('/*', {
      maxPayloadLength: 1024 * 1024 * 10, // 10 mb max payload
      idleTimeout: 100,
      maxBackpressure: 1024,
      // compression: uws.SHARED_COMPRESSOR,
      upgrade: server.auth?.authorizeConnection
        ? (res, req, ctx) => {
            upgradeAuthorize(server.auth.authorizeConnection, res, req, ctx)
          }
        : upgrade,
      message: (ws, data, isBinary) => {
        message(server, ws.c, data, isBinary)
      },
      open: (ws: WebSocketSession) => {
        if (ws) {
          const ctx: Context<WebSocketSession> = {
            session: ws,
          }
          ws.c = ctx
          wsListeners.open(ctx)
        }
      },
      close: (ws: WebSocketSession) => {
        // cl--
        ws.obs.forEach((id) => {
          unsubscribeWsIgnoreClient(server, id, ws.c)
        })
        wsListeners.close(ws.c)

        // Looks really ugly but same impact on memory and GC as using the ws directly
        // and better for dc's when functions etc are in progress
        ws.c.session = null
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
