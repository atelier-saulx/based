import uws from '@based/uws'
import initUws from './initUws'
import { ServerOptions } from './types'
import { BasedFunctions } from './functions'

export class BasedServer {
  public functions: BasedFunctions

  public port: number

  public uwsApp: uws.TemplatedApp

  public listenSocket: any

  constructor(opts: ServerOptions) {
    initUws(this, opts)
    this.functions = new BasedFunctions(this, opts.functions)
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
          console.info('💫  Based-server v2 listening on port:', this.port)
          // do this better wrap a nice thing arround it
          this.listenSocket = listenSocket
          resolve(this)
        } else {
          console.info('🤮  Based-server v2 error on port:', this.port)
          reject(new Error('Cannot start based-server on port: ' + this.port))
        }
      })
    })
  }

  async destroy() {
    console.info('🔥 Based-server v2 Destroy based-server')
    if (this.listenSocket) {
      uws.us_listen_socket_close(this.listenSocket)
      this.listenSocket = null
    }
    this.listenSocket = null
    this.uwsApp = null
  }
}

const createServer = async (props: ServerOptions): Promise<BasedServer> => {
  const basedServer = new BasedServer(props)
  return props.port ? basedServer.start() : basedServer
}

export default createServer
