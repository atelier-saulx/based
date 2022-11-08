import { join } from 'path'
import { AuthState } from '../network/message/auth'
import { encodeAuthResponse, valueToBuffer } from '../protocol'
import { BasedServer } from '../server'
import {
  AuthConfig,
  Authorize,
  WebsocketClient,
  BasedWorker,
  ClientContext,
} from '../types'

export class BasedAuth {
  server: BasedServer
  config: AuthConfig = {}

  authorize: Authorize

  constructor(
    server: BasedServer,
    config: AuthConfig = {
      authorizePath: join(__dirname, './dummyAuth'),
    }
  ) {
    this.server = server
    this.updateConfig(config)
  }

  updateConfig(config: AuthConfig) {
    if (!config) {
      return
    }

    if (config.authorizeConnection) {
      this.config.authorizeConnection = config.authorizeConnection
    }

    if (config.authorizePath !== this.config.authorizePath) {
      const server = this.server

      this.config.authorizePath = config.authorizePath

      this.authorize = (client: ClientContext, name: string, payload: any) => {
        return new Promise((resolve, reject) => {
          const id = ++server.functions.reqId
          // max concurrent execution is 1 mil...
          if (server.functions.workerResponseListeners.size >= 1e6) {
            throw new Error(
              'MAX CONCURRENT SERVER FUNCTION EXECUTION REACHED (1 MIL)'
            )
          }
          if (server.functions.reqId > 1e6) {
            server.functions.reqId = 0
          }
          const selectedWorker: BasedWorker = server.functions.lowestWorker
          server.functions.workerResponseListeners.set(id, (err, p) => {
            if (err) {
              reject(err)
            } else {
              resolve(p)
            }
          })
          selectedWorker.worker.postMessage({
            type: 9,
            id,
            name: name,
            payload,
            client: {
              // TODO: way too much copy but this is tmp solution
              authState: client.authState,
              query: client.query,
              ua: client.ua,
              ip: client.ip,
            },
          })
        })
      }

      for (const worker of this.server.functions.workers) {
        console.info('go send auth to worker!')
        worker.worker.postMessage({
          type: 5,
          name: 'authorize',
          path: this.config.authorizePath,
        })
      }
    }
  }

  sendAuthUpdate(client: WebsocketClient, authState: AuthState) {
    client.ws?.send(encodeAuthResponse(valueToBuffer(authState)), true, false)
  }
}
