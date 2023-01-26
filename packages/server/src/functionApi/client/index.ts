import { Context, InternalSessionClient } from '../../context'
import { BasedServer } from '../../server'
import { callFunction } from '../callFunction'
import { BasedQuery } from './query'

export class BasedFunctionClient {
  server: BasedServer
  ctx: Context<InternalSessionClient>
  constructor(server: BasedServer) {
    this.server = server
    this.ctx = {
      session: { type: 'client', client: this },
    }
  }

  // TODO: CTX - suggest to transpile the ctx in there by static analysis only for "call"
  call(name: string, payload?: any, ctx: Context = this.ctx): Promise<any> {
    return callFunction(this.server, name, ctx, payload)
  }

  query(name: string, payload?: any): BasedQuery {
    return new BasedQuery(this.ctx, name, payload)
  }
}
