import type { ServerOptions } from '../types'
import type { BasedServer } from '../server'
import uws from '@based/uws'
import { upgradeAuthorize, upgrade } from './upgrade'

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

  app.ws('/*', {
    maxPayloadLength: 1024 * 1024 * 5,
    idleTimeout: 100,
    maxBackpressure: 1024, //
    compression: uws.SHARED_COMPRESSOR, // 1,
    upgrade: server.authorizeConnection
      ? (res, req, ctx) => {
          upgradeAuthorize(server.authorizeConnection, res, req, ctx)
        }
      : upgrade,
    message: (ws, msg) => {
      console.info('msg', msg)
      // here we handle getting a sub directly
      // message(this, ws, msg)
    },
    open: (ws) => {
      console.info('open')
      // ws.token = 'x' token - only on upgrade does make it super easy

      console.info(ws)

      // broadcast will only do diffs except when its a new sub
      // send is used to send a current value
      // open(this, ws)
    },
    close: (ws) => {
      console.info('close')
      // close(this, ws)
    },
    drain: (ws) => {
      console.info('drain')
      // call client.drain can be much more efficient
      // if (ws.client && ws.client.backpressureQueue) {
      //   ws.client.drain()
      // }
    },
  })
  // REST
  // .get('/*', (res, req) => restHandler(this, req, res))
  // .post('/*', (res, req) => restHandler(this, req, res))
  // .options('/*', (res, req) => restHandler(this, req, res))

  server.uwsApp = app
}
