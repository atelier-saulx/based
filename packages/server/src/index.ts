import uws from '@based/uws'

type ServerOptions = {
  key?: string
  cert?: string
  port: number
}

export class BasedServer {
  public port: number

  public uwsApp: uws.TemplatedApp

  public listenSocket: any

  constructor({ key, cert, port }: ServerOptions) {
    const app =
      key && cert
        ? uws.SSLApp({
            key_file_name: key,
            cert_file_name: cert,
            ssl_prefer_low_memory_usage: true,
          })
        : uws.App()

    if (port) {
      this.port = port
    }

    /*
    open:ws=>ws.subscribe('all')

    app.publish('all',message)
    */

    // investigate pub / sub for observables
    app.ws('/*', {
      // make this lower
      maxPayloadLength: 1024 * 1024 * 16 * 1000, // 5mb should be more then enough
      idleTimeout: 100,
      maxBackpressure: 1024, //
      compression: uws.SHARED_COMPRESSOR, // 1,
      upgrade: (res, req, ctx) => {
        console.info('upgrade')
        // upgrade(this, res, req, ctx)
      },
      message: (ws, msg) => {
        console.info('msg')

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

    this.uwsApp = app
  }

  start(port?: number): Promise<BasedServer> {
    if (!port) {
      port = this.port
    } else {
      this.port = port
    }
    return new Promise((resolve, reject) => {
      this.uwsApp.listen(this.port, (listenSocket) => {
        if (listenSocket) {
          console.info('💫  Based-server listening on port:', this.port)
          // do this better wrap a nice thing arround it
          this.listenSocket = listenSocket
          resolve(this)
        } else {
          console.info('🤮  Based-server error on port:', this.port)
          reject(new Error('Cannot start based-server on port: ' + this.port))
        }
      })
    })
  }

  async destroy() {
    console.info('🔥  Destroy based-server')
    // for (const c in this.clients) {
    //   this.clients[c].destroy()
    //   delete this.clients[c]
    // }
    if (this.listenSocket) {
      uws.us_listen_socket_close(this.listenSocket)
      this.listenSocket = null
    }
    this.listenSocket = null
    this.uwsApp = null
    // await this.db.destroy()
    // this.db = null

    // clean up subscriptions (tmp)
    // await wait(1000)
  }
}

const createServer = async (props: ServerOptions): Promise<BasedServer> => {
  const basedServer = new BasedServer(props)
  return props.port ? basedServer.start() : basedServer
}

export default createServer
