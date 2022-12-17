import { AuthState } from '../incoming/ws/auth'
import { encodeAuthResponse, valueToBuffer } from '../protocol'
import { BasedServer } from '../server'
import { AuthConfig, Authorize, AuthorizeConnection } from './types'
import { Context, WebSocketSession } from '../client'
import dummyAuth from './dummyAuth'

export * from './types'

export class BasedAuth {
  server: BasedServer
  authorize: Authorize
  authorizeConnection: AuthorizeConnection

  constructor(
    server: BasedServer,
    config: AuthConfig = {
      authorize: dummyAuth,
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
      this.authorizeConnection = config.authorizeConnection
    }

    if (config.authorize) {
      this.authorize = config.authorize
    }
  }

  sendAuthUpdate(ctx: Context<WebSocketSession>, authState: AuthState) {
    ctx.session?.send(encodeAuthResponse(valueToBuffer(authState)), true, false)
  }
}
