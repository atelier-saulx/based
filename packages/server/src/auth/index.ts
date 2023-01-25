import { encodeAuthResponse, valueToBuffer } from '../protocol'
import { BasedServer } from '../server'
import { AuthConfig, Authorize, AuthorizeConnection, AuthState } from './types'
import { Context, WebSocketSession } from '../context'
import dummyAuth from './dummyAuth'
import parseAuthState from './parseAuthState'

export { parseAuthState }

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
