import { AuthState } from './auth'
import { BasedChannel } from './channel'
import { Context } from './context'
import { BasedQuery } from './query'
import { StreamFunctionOpts } from './stream'

// TODO: this is the place where we will add extra specifications
export abstract class BasedFunctionClient {
  server: any

  abstract call(name: string, payload?: any, ctx?: Context): Promise<any>

  abstract query(name: string, payload?: any): BasedQuery

  abstract channel(name: string, payload?: any): BasedChannel

  abstract stream(
    name: string,
    payload: StreamFunctionOpts,
    ctx?: Context
  ): Promise<any>

  abstract sendAuthState(ctx: Context, authState: AuthState): void

  abstract renewAuthState(ctx: Context, authState?: AuthState): void
}
