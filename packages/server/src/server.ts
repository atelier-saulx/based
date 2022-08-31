import uws from '@based/uws'
import initNetwork from './network'
import type {
  AuthorizeConnection,
  ServerOptions,
  ActiveObservable,
} from './types'
import { BasedFunctions } from './functions'

export class BasedServer {
  public functions: BasedFunctions

  public port: number

  public uwsApp: uws.TemplatedApp

  public listenSocket: any

  public authorizeConnection: AuthorizeConnection

  public activeObservables: {
    [name: string]: Map<number, ActiveObservable>
  } = {}

  public activeObservablesById: Map<number, ActiveObservable> = new Map()

  constructor(opts: ServerOptions) {
    initNetwork(this, opts)
    this.functions = new BasedFunctions(this, opts.functions)
    if (opts.authorizeConnection) {
      this.authorizeConnection = opts.authorizeConnection
    }
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
