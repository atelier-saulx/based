import type { BasedServer, ServerOptions } from '../server.js'
import uws from '../../uws/index.js'
import { upgradeAuthorize, upgrade } from './upgrade.js'
import { message } from './ws/index.js'
import { unsubscribeWsIgnoreClient } from '../query/index.js'
import { unsubscribeChannelIgnoreClient } from '../channel/index.js'
import { httpHandler } from './http/index.js'
import { sendAndVerifyAuthMessage } from './ws/auth.js'
import type {
  BasedWebSocket,
  Context,
  WebSocketSession,
} from '../../functions/index.js'

export default (
  server: BasedServer,
  {
    key,
    cert,
    port,
    ws: wsOptions = {},
    disableRest,
    disableWs,
  }: ServerOptions,
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
      maxPayloadLength: 1024 * 1024 * 30, // 30 mb max payload
      idleTimeout: 100,
      maxBackpressure: wsOptions.maxBackpressureSize,
      closeOnBackpressureLimit: Boolean(wsOptions.maxBackpressureSize),
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
        // @ts-ignore
        message(server, session.c, data, isBinary)
      },

      open: (ws: BasedWebSocket) => {
        if (ws) {
          const session = ws.getUserData()
          const ctx: Context<WebSocketSession> = {
            session,
          }
          // allways - or make it a flag
          ws.subscribe('reload')

          // or if lastReloadSeqId
          if (
            server.sendInitialForceReload ||
            (session.authState.t === 1 && server.encodedForceReload)
          ) {
            ws.send(server.encodedForceReload, true, false)
          }

          session.ws = ws
          session.c = ctx
          wsOptions.open!(ctx)

          // lastReloadSeqId
          if (session.authState.token || session.authState.refreshToken) {
            sendAndVerifyAuthMessage(server, ctx)
          }
        }
      },
      close: (ws: BasedWebSocket) => {
        const session = ws.getUserData()

        if (session.streams) {
          for (const key in session.streams) {
            session.streams[key].stream.destroy()
            delete session.streams[key]
          }
        }

        session.obs.forEach((id) => {
          if (unsubscribeWsIgnoreClient(server, id, session.c!)) {
            // This is here for channels so we do not need to keep a seperate obs set on clients
            unsubscribeChannelIgnoreClient(server, id, session.c!)
          }
        })
        if (session.onClose) {
          session.onClose()
        }
        wsOptions.close!(session.c!)
        // Looks really ugly but same impact on memory and GC as using the ws directly
        // and better for dc's when functions etc are in progress
        session.ws = undefined
        session.c!.session = undefined
        session.c = undefined
      },
      drain: () => {
        // console.log('DRAIN?')
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
    app.del('/*', (res, req) => httpHandler(server, req, res))
    app.put('/*', (res, req) => httpHandler(server, req, res))
    app.patch('/*', (res, req) => httpHandler(server, req, res))
    app.options('/*', (res, req) => httpHandler(server, req, res))
    app.head('/*', (res, req) => httpHandler(server, req, res))
    app.trace('/*', (res, req) => httpHandler(server, req, res))

    // app.ad
  }

  server.uwsApp = app
}
