import { deepMerge } from '@saulx/utils'
import { join } from 'path'
import { AuthState } from '../network/message/auth'
import { encodeAuthResponse, valueToBuffer } from '../protocol'
import { BasedServer } from '../server'
import { AuthConfig, Authorize, WebsocketClient } from '../types'
import dummyAuth from './dummyAuth'

export class BasedAuth {
  server: BasedServer
  config: AuthConfig
  authorize: Authorize = dummyAuth

  constructor(server: BasedServer, config?: AuthConfig) {
    this.server = server
    this.config = {
      authorizePath: join(__dirname, './dummyAuth'),
    }
    this.updateConfig(config)
  }

  updateConfig(config: AuthConfig) {
    if (!config) {
      return
    }

    if (config.authorizePath !== this.config.authorizePath) {
      if (this.config.authorizePath) {
        delete require.cache[require.resolve(this.config.authorizePath)]
      }

      this.authorize = require(config.authorizePath)

      for (const worker of this.server.functions.workers) {
        worker.worker.postMessage({
          type: 5,
          name: 'authorize', // default name for this...
          path: this.config.authorizePath,
        })
      }
    }

    deepMerge(this.config, config)
  }

  sendAuthUpdate(client: WebsocketClient, authState: AuthState) {
    client.ws?.send(encodeAuthResponse(valueToBuffer(authState)), true, false)
  }
}
