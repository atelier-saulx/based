import { encodeAuthResponse, valueToBuffer } from '../protocol'
import { BasedServer } from '../server'
import {
  AuthConfig,
  Authorize,
  AuthorizeConnection,
  AuthState,
  VerifyAuthState,
} from './types'
import { Context, WebSocketSession } from '../context'
import { dummyConfig } from './dummy'
import parseAuthState from './parseAuthState'

export { parseAuthState }

export * from './types'

export class BasedAuth {
  server: BasedServer
  authorize: Authorize
  authorizeConnection: AuthorizeConnection
  verifyAuthState: VerifyAuthState

  constructor(server: BasedServer, config: AuthConfig = dummyConfig) {
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

    if (config.verifyAuthState) {
      this.verifyAuthState = config.verifyAuthState
    }
  }

  sendAuthState(ctx: Context<WebSocketSession>, authState: AuthState) {
    ctx.session?.send(encodeAuthResponse(valueToBuffer(authState)), true, false)
  }
}
