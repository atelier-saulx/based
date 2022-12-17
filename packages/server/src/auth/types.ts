import { BasedServer } from '../server'
import { Context } from '../context'
import uws from '@based/uws'

export type AuthConfig = {
  authorize?: Authorize
  authorizeConnection?: AuthorizeConnection
}

export type Authorize = (
  context: Context,
  name: string,
  payload?: any
) => Promise<boolean>

export type AuthorizeHandshake = (
  server: BasedServer,
  context: Context,
  payload?: any
) => Promise<boolean>

export type AuthorizeConnection = (req: uws.HttpRequest) => Promise<boolean>
