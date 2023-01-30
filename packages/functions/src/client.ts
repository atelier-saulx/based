import { AuthState } from './auth'
import { Context } from './context'
import { BasedQuery } from './query'

export abstract class BasedFunctionClient {
  server: any

  abstract call(name: string, payload?: any, ctx?: Context): Promise<any>

  abstract query(name: string, payload?: any): BasedQuery

  abstract stream(name: string, stream?: any, ctx?: Context): Promise<any>

  abstract sendAuthState(ctx: Context, authState: AuthState): void

  abstract renewAuthState(ctx: Context, authState?: AuthState): void
}
