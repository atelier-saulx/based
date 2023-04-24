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
import parseJSONAuthState from './parseJSONAuthState'
import { reEvaulateUnauthorized } from '../incoming/ws/auth'

export { parseAuthState }
export { parseJSONAuthState }

export type AuthConfig = {
  /** This function is called before any BasedFunction that isn't public.
   * The BasedFunction requested will only execute if `authorize` returns `true`. */
  authorize?: Authorize
  authorizeConnection?: AuthorizeConnection
  /** This function is called every time an authState is set.
   * @returns `true` if the authState is valid and does not need to be updated
   * @returns `AuthState` object if the authState of the session needs to be updated
   */
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

  /** Calls `verifyAuthState` on the current session's authState.
   * If it's in a wsContext, sends the new verified authState to the client and updates the session's authState.
   */
  async renewAuthState(
    ctx: Context,
    authState?: AuthState
  ): Promise<AuthState> {
    if (!ctx.session) {
      return
    }

    if (!('authState' in ctx.session)) {
      return
    }

    const verified = await this.server.auth.verifyAuthState(
      this.server.client,
      <Context<HttpSession> | Context<WebSocketSession>>ctx,
      authState || ctx.session.authState
    )

    if (verified === true || !ctx.session) {
      return
    }

    ctx.session.authState = verified

    if (isWsContext(ctx)) {
      reEvaulateUnauthorized(this.server, ctx)
      this.sendAuthState(ctx, verified)
    }

    return verified
  }

  encodeAuthState(authState: AuthState): string {
    return Buffer.from(JSON.stringify(authState), 'utf8').toString('base64')
  }

  decodeAuthState(authState: any): AuthState {
    return parseAuthState(authState)
  }

  /** Sets the `authState` on the client. */
  sendAuthState(ctx: Context<WebSocketSession>, authState: AuthState) {
    ctx.session?.ws.send(
      encodeAuthResponse(valueToBuffer(authState)),
      true,
      false
    )
  }
}
