import { deepMerge } from '@saulx/utils'
import { join } from 'path'
import { AuthState } from '../network/message/auth'
import { encodeAuthResponse, valueToBuffer } from '../protocol'
import { BasedServer } from '../server'
import { AuthConfig, Authorize, WebsocketClient } from '../types'

export class BasedAuth {
  server: BasedServer
  config: AuthConfig
  authorize: Authorize
  constructor(server: BasedServer, config?: AuthConfig) {
    this.server = server
    this.config = {
      authorizePath: join(__dirname, './dummyAuth'),
    }
    this.updateConfig(config)
  }

  updateConfig(config: AuthConfig) {
    deepMerge(this.config, config)
  }

  sendAuthUpdate(client: WebsocketClient, authState: AuthState) {
    client.ws?.send(encodeAuthResponse(valueToBuffer(authState)), true, false)
  }
}
