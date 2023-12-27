import { AuthState } from './auth.js'
import { BasedChannel } from './channel.js'
import { Context } from './context.js'
import { BasedQuery } from './query.js'
import { StreamFunctionOpts } from './stream.js'
import { Geo } from './geo.js'

export abstract class BasedFunctionClient {
  server: any

  db: any

  abstract call(name: string, payload?: any, ctx?: Context): Promise<any>

  abstract query(name: string, payload?: any): BasedQuery

  abstract channel(name: string, payload?: any): BasedChannel

  abstract stream(
    name: string,
    payload: StreamFunctionOpts,
    ctx?: Context
  ): Promise<any>

  abstract sendAuthState(ctx: Context, authState: AuthState): void

  abstract geo(ctx: Context): Promise<Geo>

  abstract renewAuthState(
    ctx: Context,
    authState?: AuthState
  ): Promise<AuthState>
}

export type QueryMap = { [key: string]: { payload: any; result: any } }
