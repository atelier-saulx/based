import { deepMerge } from '@saulx/utils'
import { AuthState } from '../network/message/auth'
import { encodeAuthResponse, valueToBuffer } from '../protocol'
import { BasedServer } from '../server'
import { AuthConfig, WebsocketClient } from '../types'
import { authorize } from './authorize'

export class BasedAuth {
  server: BasedServer
  config: AuthConfig

  constructor(server: BasedServer, config?: AuthConfig) {
    this.server = server
    this.config = {
      authorize,
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
