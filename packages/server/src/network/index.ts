import type { ServerOptions } from '../types'
import type { BasedServer } from '../server'
import uws from '@based/uws'
import upgrade from './upgrade'

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
    // make this lower
    // chunks from client as well
    maxPayloadLength: 1024 * 1024 * 5, // 5mb should be more then enough
    idleTimeout: 100,
    maxBackpressure: 1024, //
    compression: uws.SHARED_COMPRESSOR, // 1,
    upgrade: (res, req, ctx) => {
      upgrade(server, res, req, ctx)
    },
    message: (ws, msg) => {
      console.info('msg', msg)

      // message(this, ws, msg)
    },
    open: (ws) => {
      console.info('open')
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
