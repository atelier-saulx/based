import { BasedServer } from '../../server.js'
import { callFunction } from '../callFunction.js'
import { BasedQuery } from './query.js'
import { BasedChannel } from './channel.js'
import { streamFunction } from '../stream.js'
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

export class BasedServerFunctionClient extends BasedfunctionClientAbstract {
  declare server: BasedServer

  ctx: Context<InternalSessionClient>

  constructor(server: BasedServer) {
    super()
    this.server = server
    this.ctx = {
      session: { type: 'client', client: this, headers: {} },
    }
  }

  // geo(ctx: Context) {
  //   return this.server.geo(ctx)
  // }

  // TODO: CTX - Transpile the ctx in there by static analysis for "call" & "stream"
  call(name: string, payload?: any, ctx: Context = this.ctx): Promise<any> {
    return callFunction(this.server, name, ctx, payload)
  }

  query(
    name: string,
    payload?: any,
    attachedCtx?: Context | { [key: string]: any },
  ): BasedQuery {
    return new BasedQuery(this.ctx, name, payload, attachedCtx)
  }

  channel(name: string, payload?: any): BasedChannel {
    return new BasedChannel(this.ctx, name, payload)
  }

  async stream(
    name: string,
    streamOpts: StreamFunctionOpts,
    ctx: Context = this.ctx,
  ): Promise<any> {
    // make later
    return streamFunction(this.server, name, ctx, streamOpts)
  }

  renewAuthState(
    ctx: Context<Session>,
    authState?: AuthState,
  ): Promise<AuthState> {
    return this.server.auth.renewAuthState(ctx, authState)
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
