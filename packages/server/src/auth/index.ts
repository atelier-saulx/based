import uws from '@based/uws'
import { deepMerge } from '@saulx/utils'
import { AuthState } from '../network/message/auth'
import { encodeAuthResponse, valueToBuffer } from '../protocol'
import { BasedServer } from '../server'
import { AuthConfig } from '../types'
import { authorize } from './authorize'

// has an authorize config

// 'authorize'
// 'authorize-advanced'

// class here this is where you store all the authorize stuff

//  sendAuthUpdate: (ws: uws.WebSocket, payload: any) {}

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

  sendAuthUpdate(ws: uws.WebSocket, authState: AuthState) {
    ws.send(encodeAuthResponse(valueToBuffer(authState)), true, false)
  }
}
