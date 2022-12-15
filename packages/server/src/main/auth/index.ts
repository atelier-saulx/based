import { join } from 'path'
import { AuthState } from '../incoming/ws/auth'
import { encodeAuthResponse, valueToBuffer } from '../../protocol'
import { BasedServer } from '../server'
import {
  AuthConfig,
  Authorize,
  WebsocketClient,
  BasedWorker,
  ClientContext,
} from '../../types'
import { sendToWorker } from '../worker'
import { IncomingType } from '../../worker/types'

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

          sendToWorker(selectedWorker, {
            type: IncomingType.Authorize,
            id,
            name,
            payload,
            context: {
              // @ts-ignore
              authState: client.authState,
              // @ts-ignore
              query: client.query,
              // @ts-ignore
              ua: client.ua,
              // @ts-ignore
              ip: client.ip,
              headers: {},
            },
          })
        })
      }

      for (const worker of this.server.functions.workers) {
        sendToWorker(worker, {
          type: IncomingType.AddFunction,
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
