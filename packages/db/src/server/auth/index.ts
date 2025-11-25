import {
  encodeAuthResponse,
  valueToBuffer,
  valueToBufferV1,
} from '../protocol.js'
import { BasedServer } from '../server.js'
import {
  Context,
  AuthState,
  WebSocketSession,
  isWsContext,
  HttpSession,
  Authorize,
  AuthorizeConnection,
  VerifyAuthState,
} from '../../functions/index.js'
import { defaultAuthorize, defaultVerifyAuthState } from './defaultConfig.js'
import parseAuthState from './parseAuthState.js'
import parseJSONAuthState from './parseJSONAuthState.js'
import { reEvaulateUnauthorized } from '../incoming/ws/auth.js'
import { deepEqual } from '../../utils/index.js'

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
  authorizeConnection?: AuthorizeConnection

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
    authState?: AuthState,
  ): Promise<AuthState> {
    if (!ctx.session) {
      return {}
    }

    if (!('authState' in ctx.session)) {
      return {}
    }

    const verified = await this.server.auth.verifyAuthState(
      this.server.client,
      <Context<HttpSession> | Context<WebSocketSession>>ctx,
      authState || ctx.session.authState!,
    )

    if (verified === true || !ctx.session) {
      return {}
    }

    if (
      typeof ctx.session.authState === 'object' &&
      typeof verified === 'object' &&
      deepEqual(ctx.session.authState, verified)
    ) {
      return {}
    }

    ctx.session.authState = verified

    if (isWsContext(ctx)) {
      if (verified.token) {
        reEvaulateUnauthorized(this.server, ctx)
      }
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
    ctx.session?.ws!.send(
      encodeAuthResponse(
        ctx.session.v! < 2
          ? valueToBufferV1(authState, true)
          : valueToBuffer(authState, true),
      ),
      true,
      false,
    )
  }
}
