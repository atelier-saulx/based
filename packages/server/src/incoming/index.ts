import type { BasedServer, ServerOptions } from '../server'
import uws from '@based/uws'
import { upgradeAuthorize, upgrade } from './upgrade'
import { message } from './ws'
import { unsubscribeWsIgnoreClient } from '../query'
import { unsubscribeChannelIgnoreClient } from '../channel'
import { httpHandler } from './http'
import { WebSocketSession, Context, BasedWebSocket } from '@based/functions'
import { sendAndVerifyAuthMessage } from './ws/auth'

export default (
  server: BasedServer,
  { key, cert, port, ws: wsOptions = {}, disableRest, disableWs }: ServerOptions
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

  if (!wsOptions.close) {
    wsOptions.close = () => undefined
  }

  if (!wsOptions.open) {
    wsOptions.open = () => undefined
  }

  if (!wsOptions.maxBackpressureSize) {
    wsOptions.maxBackpressureSize = 1024 * 1024 * 10
  }

  if (!disableWs) {
    app.ws('/*', {
      maxPayloadLength: 1024 * 1024 * 30, // 20 mb max payload
      idleTimeout: 100,
      maxBackpressure: wsOptions.maxBackpressureSize,
      closeOnBackpressureLimit: wsOptions.maxBackpressureSize,
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

      open: (ws: BasedWebSocket) => {
        if (ws) {
          const session = ws.getUserData()
          const ctx: Context<WebSocketSession> = {
            session,
          }
          session.ws = ws
          session.c = ctx
          wsOptions.open(ctx)
          if (session.authState.token || session.authState.refreshToken) {
            sendAndVerifyAuthMessage(server, ctx)
          }
        }
      },
      close: (ws: BasedWebSocket) => {
        const session = ws.getUserData()
        session.obs.forEach((id) => {
          if (unsubscribeWsIgnoreClient(server, id, session.c)) {
            // This is here for channels so we do not need to keep a seperate obs set on clients
            unsubscribeChannelIgnoreClient(server, id, session.c)
          }
        })
        wsOptions.close(session.c)
        // Looks really ugly but same impact on memory and GC as using the ws directly
        // and better for dc's when functions etc are in progress
        session.ws = null
        session.c.session = null
        session.c = null
      },
      drain: () => {
        // lets handle drain efficiently (or more efficiently at least)
        // call client.drain can be much more efficient
        // if (ws.client && ws.client.backpressureQueue) {
        //   ws.client.drain()
        // }
      },
    })
  }

  if (!disableRest) {
    app.get('/*', (res, req) => httpHandler(server, req, res))
    app.post('/*', (res, req) => httpHandler(server, req, res))
    app.options('/*', (res, req) => httpHandler(server, req, res))
  }

  server.uwsApp = app
}
