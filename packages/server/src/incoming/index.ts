import type { BasedServer, ServerOptions } from '../server'
import uws from '@based/uws'
import { upgradeAuthorize, upgrade } from './upgrade'
import { message } from './ws'
import { unsubscribeWsIgnoreClient } from '../observable'
import { unsubscribeChannelIgnoreClient } from '../channel'
import { httpHandler } from './http'
import { WebSocketSession, Context } from '@based/functions'
import { sendAndVerifyAuthMessage } from './ws/auth'

export default (
  server: BasedServer,
  { key, cert, port, ws: wsListeners, disableRest }: ServerOptions
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

  app.ws('/*', {
    maxPayloadLength: 1024 * 1024 * 20, // 10 mb max payload
    idleTimeout: 100,
    maxBackpressure: 1024 * 1024 * 10,
    closeOnBackpressureLimit: 1024 * 1024 * 10,
    // No compression handled in the protocol
    // compression: uws.SHARED_COMPRESSOR,
    upgrade: server.auth?.authorizeConnection
      ? (res, req, ctx) => {
          upgradeAuthorize(server, res, req, ctx)
        }
      : (res, req, ctx) => {
          upgrade(server, res, req, ctx)
        },
    message: (ws, data, isBinary) => {
      const session = ws.getUserData()
      message(server, session.c, data, isBinary)
    },

    open: (ws: WebSocketSession) => {
      if (ws) {
        const ctx: Context<WebSocketSession> = {
          session: ws,
        }
        const session = ws.getUserData()
        session.c = ctx
        wsListeners.open(ctx)
        if (session.authState.token || session.authState.refreshToken) {
          sendAndVerifyAuthMessage(server, ctx)
        }
      }
    },
    close: (ws: WebSocketSession) => {
      const session = ws.getUserData()
      session.obs.forEach((id) => {
        if (unsubscribeWsIgnoreClient(server, id, session.c)) {
          // This is here for channels so we do not need to keep a seperate obs set on clients
          unsubscribeChannelIgnoreClient(server, id, session.c)
        }
      })
      wsListeners.close(session.c)
      // Looks really ugly but same impact on memory and GC as using the ws directly
      // and better for dc's when functions etc are in progress
      session.c.session = null
      session.c = null
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

  if (!disableRest) {
    app.get('/*', (res, req) => httpHandler(server, req, res))
    app.post('/*', (res, req) => httpHandler(server, req, res))
    app.options('/*', (res, req) => httpHandler(server, req, res))
  }

  server.uwsApp = app
}
