import { BasedServer } from '../../server'
import { callFunction } from '../callFunction'
import { BasedQuery } from './query'
import {
  BasedFunctionClient as BasedfunctionClientAbstract,
  Context,
  InternalSessionClient,
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

  async stream(name: string, stream?: any): Promise<any> {
    // make later
    return { name, stream }
  }
}