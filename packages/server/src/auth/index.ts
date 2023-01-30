import { encodeAuthResponse, valueToBuffer } from '../protocol'
import { BasedServer } from '../server'
import {
  Context,
  AuthState,
  WebSocketSession,
  isWsContext,
  HttpSession,
  Authorize,
  AuthorizeConnection,
  VerifyAuthState,
} from '@based/functions'
import { defaultAuthorize, defaultVerifyAuthState } from './defaultConfig'
import parseAuthState from './parseAuthState'

export { parseAuthState }

export type AuthConfig = {
  authorize?: Authorize
  authorizeConnection?: AuthorizeConnection
  verifyAuthState?: VerifyAuthState
}

export class BasedAuth {
  server: BasedServer
  authorizeConnection: AuthorizeConnection

  verifyAuthState: VerifyAuthState = defaultVerifyAuthState
  authorize: Authorize = defaultAuthorize

  constructor(server: BasedServer, config: AuthConfig = {}) {
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

  renewAuthState(ctx: Context, authState?: AuthState) {
    if (!ctx.session) {
      return
    }

    if (!('authState' in ctx.session)) {
      return
    }

    const verified =
      authState ||
      this.server.auth.verifyAuthState(
        this.server.client,
        <Context<HttpSession> | Context<WebSocketSession>>ctx,
        ctx.session.authState
      )
    if (verified === true) {
      return
    }
    ctx.session.authState = verified
    if (isWsContext(ctx)) {
      this.sendAuthState(ctx, verified)
    }
  }

  encodeAuthState(authState: AuthState): string {
    return Buffer.from(JSON.stringify(authState), 'utf8').toString('base64')
  }

  decodeAuthState(authState: any): AuthState {
    return parseAuthState(authState)
  }

  sendAuthState(ctx: Context<WebSocketSession>, authState: AuthState) {
    ctx.session?.send(encodeAuthResponse(valueToBuffer(authState)), true, false)
  }
}
