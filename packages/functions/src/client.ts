import { AuthState } from './auth'
import { Context } from './context'
import { BasedQuery } from './query'
import { StreamFunctionOpts } from './stream'

export abstract class BasedFunctionClient {
  server: any

  abstract call(name: string, payload?: any, ctx?: Context): Promise<any>

  abstract query(name: string, payload?: any): BasedQuery

  abstract stream(
    name: string,
    payload: StreamFunctionOpts,
    ctx?: Context
  ): Promise<any>

  abstract sendAuthState(ctx: Context, authState: AuthState): void

  abstract renewAuthState(ctx: Context): void
}
