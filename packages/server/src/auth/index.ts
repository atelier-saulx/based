import uws from '@based/uws'
import { deepMerge } from '@saulx/utils'
import { BasedServer } from '../server'
import { AuthConfig } from '../types'
import { authorize, authorizeAdvanced } from './defaults'

// has an authorize config

// 'authorize'
// 'authorize-advanced'

// class here this is where you store all the authorize stuff

//  sendAuthUpdate: (ws: uws.WebSocket, payload: any) {}

export class BasedAuth {
  server: BasedServer
  config: AuthConfig
  // sendAuthUpdate

  constructor(server: BasedServer, config?: AuthConfig) {
    this.server = server
    this.config = {
      authorize,
      authorizeAdvanced,
    }
    this.updateConfig(config)
  }

  updateConfig(config: AuthConfig) {
    deepMerge(this.config, config)
  }
}
