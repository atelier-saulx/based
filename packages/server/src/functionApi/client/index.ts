import { BasedServer } from '../../server'
import { callFunction } from '../callFunction'
import { BasedQuery } from './query'
import { BasedChannel } from './channel'
import { streamFunction } from '../stream'
import util from 'node:util'
import {
  AuthState,
  BasedFunctionClient as BasedfunctionClientAbstract,
  Context,
  InternalSessionClient,
  isClientContext,
  isWsContext,
  StreamFunctionOpts,
  Session,
} from '@based/functions'

export class BasedFunctionClient extends BasedfunctionClientAbstract {
  server: BasedServer
  ctx: Context<InternalSessionClient>

  constructor(server: BasedServer) {
    super()
    this.server = server
    this.ctx = {
      session: { type: 'client', client: this },
    }
  }

  // TODO: CTX - Transpile the ctx in there by static analysis for "call" & "stream"
  call(name: string, payload?: any, ctx: Context = this.ctx): Promise<any> {
    return callFunction(this.server, name, ctx, payload)
  }

  query(name: string, payload?: any): BasedQuery {
    return new BasedQuery(this.ctx, name, payload)
  }

  channel(name: string, payload?: any): BasedChannel {
    return new BasedChannel(this.ctx, name, payload)
  }

  async stream(
    name: string,
    streamOpts: StreamFunctionOpts,
    ctx: Context = this.ctx
  ): Promise<any> {
    // make later
    return streamFunction(this.server, name, ctx, streamOpts)
  }

  renewAuthState(ctx: Context<Session>, authState?: AuthState): void {
    this.server.auth.renewAuthState(ctx, authState)
  }

  setAuthState(ctx: Context<Session>, authState: AuthState): void {
    if (!ctx.session) {
      return
    }
    if (!isClientContext(ctx)) {
      return
    }
    ctx.session.authState = authState
    this.server.auth.renewAuthState(ctx)
  }

  sendAuthState(ctx: Context<Session>, authState: AuthState): void {
    if (!isWsContext(ctx)) {
      return
    }
    this.server.auth.sendAuthState(ctx, authState)
  }

  [util.inspect.custom]() {
    return `[BasedFunctionClient]`
  }
}
